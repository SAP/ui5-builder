import workerpool from "workerpool";
import themeBuilder from "./themeBuilder.js";
import {createResource} from "@ui5/fs/resourceFactory";
import {Buffer} from "node:buffer";
import { callbackify } from "node:util";

/**
 * Task to build library themes.
 *
 * @private
 * @function default
 * @static
 *
 * @param {object} parameters Parameters
 * @param {MessagePort} parameters.fsInterfacePort
 * @param {object[]} parameters.themeResources Input array of Uint8Array transferable objects
 * 	that are the less sources to build upon. By nature those are @ui5/fs/Resource.
 * @param {object} parameters.options Less compiler options
 * @returns {Promise<object[]>} Resulting array of Uint8Array transferable objects
 */
export default async function execThemeBuild({
	fsInterfacePort,
	themeResources = [],
	options = {}
}) {
	const fsThemeResources = deserializeResources(themeResources);
	const fsReader = new FsWorkerThreadInterface(fsInterfacePort);

	const result = await themeBuilder({
		resources: fsThemeResources,
		fs: fsReader,
		options
	});

	return serializeResources(result);
}

/**
 * Casts @ui5/fs/Resource-s into an Uint8Array transferable object
 *
 * @param {@ui5/fs/Resource[]} resourceCollection
 * @returns {Promise<object[]>}
 */
export async function serializeResources(resourceCollection) {
	return Promise.all(
		resourceCollection.map(async (res) => ({
			buffer: await res.getBuffer(),
			path: res.getPath()
		}))
	);
}

/**
 * Casts Uint8Array into @ui5/fs/Resource-s transferable object
 *
 * @param {Promise<object[]>} resources
 * @returns {@ui5/fs/Resource[]}
 */
export function deserializeResources(resources) {
	return resources.map((res) => {
		// res.buffer is an Uint8Array object and needs to be cast
		// to a Buffer in order to be read correctly.
		return createResource({path: res.path, buffer: Buffer.from(res.buffer)});
	});
}

class AbstractMain {
	_comPorts = new Set();
	_collection = null;
	_cache = Object.create(null);

	/**
	 * Constructor
	 */
	constructor(collection) {
		if (!collection) {
			throw new Error("collection is mandatory argument");
		}

		this._collection = collection;
	}

	/**
	 * Adds MessagePort and starts listening for requests on it.
	 *
	 * @param {MessagePort} comPort port1 from a {code}MessageChannel{/code}
	 */
	startCommunication(comPort) {
		if (!comPort) {
			throw new Error("Communication channel is mandatory argument");
		}

		this._comPorts.add(comPort);
		comPort.on("message", (e) => this.#onMessage(e, comPort));
		comPort.on("close", () => comPort.close());
	}

	/**
	 * Ends MessagePort communication.
	 *
	 * @param {MessagePort} comPort port1 to remove from handling.
	 */
	endCommunication(comPort) {
		comPort.close();
		this._comPorts.delete(comPort);
	}

	/**
	 * Destroys the FsMainThreadInterface
	 */
	cleanup() {
		this._comPorts.forEach((comPort) => comPort.close());
		this._cache = null;
		this._collection = null;
	}

	/**
	 * Handles messages from the MessagePort
	 *
	 * @param {object} e data to construct the request
	 * @param {string} e.action Action to perform. Corresponds to the names of
	 * 	the public methods of "@ui5/fs/fsInterface"
	 * @param {string} e.fsPath Path of the Resource
	 * @param {object} e.options Options for "readFile" action
	 * @param {MessagePort} comPort The communication channel
	 */
	async #onMessage(e, comPort) {
		const {action, args, key: cacheKey} = e;

		if (!this._cache[cacheKey]) {
			this._cache[cacheKey] = this.get(action, args);
		}

		const fromCache = await this._cache[cacheKey];
		comPort.postMessage({action, key: cacheKey, ...fromCache});
	}

	get(method) {
		throw new Error(`${method} method's handler has to be implemented`);
	}
}

/**
 * "@ui5/fs/fsInterface" like class that uses internally
 * "@ui5/fs/fsInterface", implements its methods, and
 * sends the results to a MessagePort.
 *
 * Used in the main thread in a combination with FsWorkerThreadInterface.
 */
export class FsMainThreadInterface extends AbstractMain {
	constructor(fsInterfacePort) {
		super(fsInterfacePort);
	}

	get(method, args) {
		const {fsPath, options} = args;
		const composedArgs = [fsPath, options].filter(($) => $ !== undefined);

		return new Promise((resolve) => {
			this._collection[method](...composedArgs, (error, result) => {
				resolve({error, result});
			});
		});
	}
}

class AbstractThread {
	#comPort = null;
	#callbacks = [];
	#cache = Object.create(null);

	/**
	 * Constructor
	 *
	 * @param {MessagePort} comPort Communication port
	 */
	constructor(comPort) {
		if (!comPort) {
			throw new Error("Communication port is mandatory argument");
		}

		this.#comPort = comPort;
		comPort.on("message", this.#onMessage.bind(this));
		comPort.on("close", this.#onClose.bind(this));
	}

	/**
	 * Handles messages from MessagePort
	 *
	 * @param {object} e
	 * @param {string} e.action Action to perform. Corresponds to the names of
	 * 	the public methods of "@ui5/fs/fsInterface"
	 * @param {string} e.fsPath Path of the Resource
	 * @param {*} e.result Response from the "action".
	 * @param {object} e.error Error from the "action".
	 */
	#onMessage(e) {
		const cbObject = this.#callbacks.find((cb) => cb.key === e.key);

		if (cbObject) {
			this.#cache[e.key] = {
				error: e.error,
				result: e.result,
			};
			this.#callbacks.splice(this.#callbacks.indexOf(cbObject), 1);
			cbObject.callback(e.error, e.result);
		} else {
			throw new Error(
				"No callback found for this message! Possible hang for the thread!",
				e
			);
		}
	}

	/**
	 * End communication
	 */
	#onClose() {
		this.#comPort.close();
		this.#cache = null;
	}

	/**
	 * Makes a request via the MessagePort
	 *
	 * @param {object} parameters
	 * @param {string} parameters.action Action to perform. Corresponds to the names of
	 * 	the public methods.
	 * @param {string} parameters.fsPath Path of the Resource
	 * @param {object} parameters.options Options for "readFile" action
	 * @param {Function} callback Callback to call when the "action" is executed and ready.
	 */
	_doRequest({action, key, args}, callback) {
		// fsPath, options
		if (this.#cache[key]) {
			const {result, error} = this.#cache[key];
			callback(error, result);
		} else {
			this.#callbacks.push({key, callback});
			this.#comPort.postMessage({action, key, args});
		}
	}
}

/**
 * "@ui5/fs/fsInterface" like class that uses internally
 * "@ui5/fs/fsInterface", implements its methods, and
 * requests resources via MessagePort.
 *
 * Used in the worker thread in a combination with FsMainThreadInterface.
 */
export class FsWorkerThreadInterface extends AbstractThread {
	readFile(fsPath, options, callback) {
		const key = `${fsPath}-readFile`;
		this._doRequest({action: "readFile", key, args: {fsPath, options}}, callback);
	}

	stat(fsPath, callback) {
		const key = `${fsPath}-stat`;
		this._doRequest({action: "stat", key, args: {fsPath}}, callback);
	}
}

// Test execution via ava is never done on the main thread
/* istanbul ignore else */
if (!workerpool.isMainThread) {
	// Script got loaded through workerpool
	// => Create a worker and register public functions
	workerpool.worker({
		execThemeBuild
	});
}
