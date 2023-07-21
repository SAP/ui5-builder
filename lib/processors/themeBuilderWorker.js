import workerpool from "workerpool";
import themeBuilder from "./themeBuilder.js";
import {createResource} from "@ui5/fs/resourceFactory";
import {Buffer} from "node:buffer";
import {getLogger} from "@ui5/logger";
const log = getLogger("builder:processors:themeBuilderWorker");

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
			// Buffer is an inherits Uint8Array, but in order to transfer it we need to cast down to Uint8Array.
			// Otherwise it would be copied instead of transferred.
			// To check whether an object is transferred or copied, check its byteLength in source destination.
			// It should be 0 === transferred.
			transferable: new Uint8Array(await res.getBuffer()),
			path: res.getPath()
		}))
	);
}

function toUintArray8(source) {
	if (typeof source === "object") {
		return new Uint8Array(Buffer.from(JSON.stringify(source)));
	} else if (typeof source === "string") {
		return new Uint8Array(Buffer.from(source));
	} else {
		return undefined;
	}
}

function fromUintArray8(source, keepString) {
	if (!source) {
		return source;
	}

	const buf = Buffer.from(source);
	let result = buf.toString();

	try {
		result = keepString ? result : JSON.parse(result);
	} catch (err) {
		log.warn(`Unable to parse a JSON (ignored): ${err.message}`);
		log.verbose(err.stack);
	}

	return result;
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

/**
 * TODO:
 * 1. Check caching. Cache also errors on Thread and Main
 * 2. Try to do a real transfer, than copying buffers
 * 3. Add comments with explanations
 */

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

	async #doRequest(comPort, {what, fsPath, options}) {
		const cacheKey = [fsPath, what].join("-");
		if (!this.#cache[cacheKey]) {
			this.#cache[cacheKey] = new Promise((res) => {
				if (what === "readFile") {
					this.#fsInterfaceReader.readFile(fsPath, options, async (error, result) =>
						res({error, result})
					);
				} else {
					this.#fsInterfaceReader[what](fsPath, async (error, result) =>
						res({error, result})
					);
				}
			});
		}

		// Read from cache and then operate on a copy of the data.
		// When the original data is transferred to the workerpool it's
		// lost in the main thread, so is the caching.
		const fromCache = await this.#cache[cacheKey];
		let resultBuffer;
		let result;
		if (fromCache.result) {
			result = {...fromCache, ...{result: toUintArray8(fromCache.result)}};
			resultBuffer = [result.result.buffer];
		} else {
			result = {...fromCache};
		}

		comPort.postMessage({what, fsPath, ...result}, resultBuffer);
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
			// Convert here, so would be cached as "simple" type, but not as Uint8Array
			const result = fromUintArray8(e.result, (e.what === "readFile"));
			this.#cache[[e.fsPath, e.what].join("-")] = {error: e.error, result};
			this.#callbacks.splice(this.#callbacks.indexOf(cbObject), 1);
			cbObject.callback(e.error, result);
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
			const {result, error} = this.#cache[cacheKey];
			callback(error, result);
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
