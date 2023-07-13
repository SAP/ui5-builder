import workerpool from "workerpool";
import themeBuilder from "./themeBuilder.js";
import {createAdapter, createResource} from "@ui5/fs/resourceFactory";
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

async function createResourcesCollection(resources) {
	const memoryAdapter = createAdapter({
		virBasePath: "/resources/"
	});

	await Promise.all(resources.map((resource) => memoryAdapter.write(resource)));
	return memoryAdapter;
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
	#port = null;
	#fsInterfaceReader = null;
	constructor(port) {
		if (!port) {
			throw new Error("Communication channel is mandatory argument");
		}

		this.#port = port;
	}

	handleResourceRequests(fsInterfaceReader) {
		this.#fsInterfaceReader = fsInterfaceReader;
		this.#port.on("message", this.onMessage.bind(this));
		// this.#port.on("messageerror", this.onMessageError);
		// this.#port.on("close", this.onClose);
	}

	onMessage(e) {
		switch (e.what) {
		case "readFile":
			return this.#fsInterfaceReader.readFile(e.fsPath, e.options,
				(error, result) => this.#port.postMessage({what: "readFile", error, result, fsPath: e.fsPath}));
		case "stat":
			return this.#fsInterfaceReader.stat(e.fsPath,
				(error, result) => this.#port.postMessage({what: "stat", error, result, fsPath: e.fsPath}));
		case "readdir":
			return this.#fsInterfaceReader.readdir(e.fsPath,
				(error, result) => this.#port.postMessage({what: "readdir", error, result, fsPath: e.fsPath}));
		case "mkdir":
			return this.#fsInterfaceReader.mkdir(e.fsPath,
				(error, result) => this.#port.postMessage({what: "mkdir", error, result, fsPath: e.fsPath}));
		}
	}

	onMessageError(e) {
		console.log(e);
	}

	onClose(e) {
		console.log(e);
	}
}

export class FsWorkerThreadInterface {
	#port = null;
	#callbacks = [];

	constructor(port) {
		if (!port) {
			throw new Error("Communication port is mandatory argument");
		}

		this.#port = port;
		this.#port.on("message", this.onMessage.bind(this));
	}

	onMessage(e) {
		const callback = this.#callbacks.find((cb) => cb.what === e.what && cb.fsPath === e.fsPath);

		if (callback) {
			this.#callbacks.splice(this.#callbacks.indexOf(callback), 1);
			callback.callback(e.error, e.result);
		} else {
			throw new Error("No callback found for this message! Possible hang for the thread!", e);
		}
	}

	readFile(fsPath, options, callback) {
		this.#callbacks.push({what: "readFile", fsPath, callback});
		this.#port.postMessage({what: "readFile", fsPath, options});
	}

	stat(fsPath, callback) {
		this.#callbacks.push({what: "stat", fsPath, callback});
		this.#port.postMessage({what: "stat", fsPath});
	}

	readdir(fsPath, callback) {
		this.#callbacks.push({what: "readdir", fsPath, callback});
		this.#port.postMessage({what: "readdir", fsPath});
	}

	mkdir(fsPath, callback) {
		this.#callbacks.push({what: "mkdir", fsPath, callback});
		this.#port.postMessage({what: "mkdir", fsPath});
	}
}
