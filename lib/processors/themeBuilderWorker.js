import workerpool from "workerpool";
import themeBuilder from "./themeBuilder.js";
import {createResource} from "@ui5/fs/resourceFactory";
import {Buffer} from "node:buffer";

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
	const fsThemeResources = uint8ToResources(themeResources);
	const fsReader = new FsWorkerThreadInterface(fsInterfacePort);

	const result = await themeBuilder({
		resources: fsThemeResources,
		fs: fsReader,
		options
	});

	return resourcesToUint8(result);
}

/**
 * Casts @ui5/fs/Resource-s into an Uint8Array transferable object
 *
 * @param {@ui5/fs/Resource[]} resourceCollection
 * @returns {Promise<object[]>}
 */
export async function resourcesToUint8(resourceCollection) {
	return Promise.all(
		resourceCollection.map(async (res) => ({
			transferable: await res.getBuffer(),
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
export function uint8ToResources(resources) {
	return resources.map((res) => {
		// res.transferable is an Uint8Array object and needs to be cast
		// to a Buffer in order to be read correctly.
		return createResource({path: res.path, buffer: Buffer.from(res.transferable)});
	});
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


export class FsMainThreadInterface {
	#comPorts = new Set();
	#fsInterfaceReader = null;
	#cache = Object.create(null);

	constructor(fsInterfaceReader) {
		if (!fsInterfaceReader) {
			throw new Error("fsReader is mandatory argument");
		}

		this.#fsInterfaceReader = fsInterfaceReader;
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

		this.#comPorts.add(comPort);
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
		this.#comPorts.delete(comPort);
	}

	/**
	 * Destroys the FsMainThreadInterface
	 */
	cleanup() {
		this.#comPorts.forEach((comPort) => comPort.close());
		this.#cache = null;
		this.#fsInterfaceReader = null;
	}

	#onMessage(e, comPort) {
		switch (e.what) {
		case "readFile":
			this.#doRequest(comPort, {what: "readFile", fsPath: e.fsPath, options: e.options});
			break;
		case "stat":
			this.#doRequest(comPort, {what: "stat", fsPath: e.fsPath});
			break;
		case "readdir":
			this.#doRequest(comPort, {what: "readdir", fsPath: e.fsPath});
			break;
		case "mkdir":
			this.#doRequest(comPort, {what: "mkdir", fsPath: e.fsPath});
			break;
		}
	}

	#doRequest(comPort, {what, fsPath, options}) {
		const cacheKey = [fsPath, what].join("-");
		const cb = (error, result) => {
			if (!error && !this.#cache[cacheKey]) {
				this.#cache[cacheKey] = result;
			}
			comPort.postMessage({what, error, result, fsPath});
		};

		if (this.#cache[cacheKey]) {
			cb(null, this.#cache[cacheKey]);
		} else {
			if (what === "readFile") {
				this.#fsInterfaceReader[what](fsPath, options, cb);
			} else {
				this.#fsInterfaceReader[what](fsPath, cb);
			}
		}
	}
}

export class FsWorkerThreadInterface {
	#comPort = null;
	#callbacks = [];
	#cache = Object.create(null);

	constructor(comPort) {
		if (!comPort) {
			throw new Error("Communication port is mandatory argument");
		}

		this.#comPort = comPort;
		this.#comPort.on("message", this.#onMessage.bind(this));
		this.#comPort.on("close", this.#onClose.bind(this));
	}

	#onMessage(e) {
		const cbObject = this.#callbacks.find((cb) => cb.what === e.what && cb.fsPath === e.fsPath);

		if (cbObject) {
			this.#cache[[e.fsPath, e.what].join("-")] = e.result;
			this.#callbacks.splice(this.#callbacks.indexOf(cbObject), 1);
			cbObject.callback(e.error, e.result);
		} else {
			throw new Error("No callback found for this message! Possible hang for the thread!", e);
		}
	}

	#onClose() {
		this.#comPort.close();
		this.#cache = null;
	}

	#doRequest({what, fsPath, options}, callback) {
		const cacheKey = [fsPath, what].join("-");

		if (this.#cache[cacheKey]) {
			callback(null, this.#cache[cacheKey]);
		} else {
			this.#callbacks.push({what, fsPath, callback});
			this.#comPort.postMessage({what, fsPath, options});
		}
	}

	readFile(fsPath, options, callback) {
		this.#doRequest({what: "readFile", fsPath, options}, callback);
	}

	stat(fsPath, callback) {
		this.#doRequest({what: "stat", fsPath}, callback);
	}

	readdir(fsPath, callback) {
		this.#doRequest({what: "readdir", fsPath}, callback);
	}

	mkdir(fsPath, callback) {
		this.#doRequest({what: "mkdir", fsPath}, callback);
	}
}
