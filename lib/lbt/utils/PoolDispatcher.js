import workerpool from "workerpool";
import os from "node:os";
import {fileURLToPath} from "node:url";
import {getLogger} from "@ui5/logger";
import {createResource} from "@ui5/fs/resourceFactory";

const MIN_WORKERS = 2;
const MAX_WORKERS = 4;
const osCpus = os.cpus().length || 1;
const maxWorkers = Math.max(Math.min(osCpus - 1, MAX_WORKERS), MIN_WORKERS);

export class PoolDispatcher {
	#log = getLogger("builder:utils:PoolDispatcher");
	#projectBuilders = [];
	#pool;
	static #ensureSingleton = false;
	static #instance;

	#getPool() {
		if (!this.#pool) {
			this.#log.verbose(
				`Creating workerpool with up to ${maxWorkers} workers (available CPU cores: ${osCpus})`
			);
			const workerPath = fileURLToPath(
				new URL("./TaskProcessorThread.js", import.meta.url)
			);
			this.#pool = workerpool.pool(workerPath, {
				workerType: "auto",
				maxWorkers,
			});
		}
		return this.#pool;
	}

	constructor() {
		if (!PoolDispatcher.#ensureSingleton) {
			throw new Error(
				"Constructor must not be called! This is a singleton class. Use Parallelizer.getInstance()"
			);
		}
	}

	static getInstance() {
		if (!PoolDispatcher.#instance) {
			PoolDispatcher.#ensureSingleton = true;
			PoolDispatcher.#instance = new PoolDispatcher();
			PoolDispatcher.#ensureSingleton = false;
		}

		return PoolDispatcher.#instance;
	}

	getProcessor(url) {
		return {
			execute: async (methodName, args) => {
				const buildUpArgs = {url, methodName, args};
				// {url, methodName, args}
				const {resources, workspace, dependencies, options} = args;
				
				return this.#getPool().exec("execInThread", [buildUpArgs]);
			}
		};
	}

	async cleanup(project) {
		const attemptPoolTermination = () => {
			if (this.#projectBuilders.length) {
				this.#log.verbose(
					`Pool termination canceled. Still pending projects to build: ${this.#projectBuilders.map(
						(project) => project.getName()
					)}`
				);
				return;
			}

			this.#log.verbose(`Attempt to terminate the workerpool...`);

			if (!this.#pool) {
				this.#log.verbose(
					"Pool termination requested, but a pool has not been initialized or already has been terminated."
				);
				return;
			}

			// There are many stats that could be used, but these ones seem the most
			// convenient. When all the (available) workers are idle, then it's safe to terminate.
			const {idleWorkers, totalWorkers} = this.#pool.stats();
			if (idleWorkers !== totalWorkers) {
				return new Promise((resolve) =>
					setTimeout(() => resolve(attemptPoolTermination()), 100) // Retry after a while
				);
			}

			return this.terminateTasks(/* terminate gracefully */);
		};

		if (project) {
			const projectIndex = this.#projectBuilders.indexOf(project);
			this.#projectBuilders.splice(projectIndex, 1);
		}

		return attemptPoolTermination();
	}

	async terminateTasks(force) {
		if (!this.#pool) {
			this.#log.verbose("Pool termination requested, but a pool has not been initialized");
			return;
		}

		this.#projectBuilders = [];
		const pool = this.#pool;
		this.#pool = null;
		return pool.terminate(force);
	}

	registerProjectBuilder(project) {
		this.#projectBuilders.push(project);
	}

	getQueuedProjectBuilders() {
		return this.#projectBuilders;
	}
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
	 * @param {string} parameters.key
	 * @param {object} parameters.args
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

export class DuplexCollectionMainInterface extends AbstractMain {
	constructor(collection) {
		super(collection);
	}

	get(method, args) {
		const {virPattern, virPath, resource, options} = args;
		const composedArgs = [virPattern, virPath, resource, options].filter(($) => $ !== undefined);

		return new Promise((resolve) => {
			this._collection[method](...composedArgs, (error, result) => {
				resolve({error, result});
			});
		});
	}
}

export class DuplexCollectionThreadInterface extends AbstractThread {
	#promisifyRequest(args) {
		return new Promise((resolve, reject) => {
			this._doRequest(args, (error, result) => {
				if (error) {
					reject(error);
				} else {
					resolve(result);
				}
			});
		});
	}

	byGlob(virPattern, options) {
		const key = virPattern;

		return this.#promisifyRequest({
			action: "byGlob",
			key,
			args: {virPattern, options},
		});
	}

	byPath(virPath, options) {
		const key = virPath;

		return this.#promisifyRequest({
			action: "byPath",
			key,
			args: {virPath, options},
		});
	}

	write(resource, options) {
		const key = resource.getName();

		return this.#promisifyRequest({
			action: "write",
			key,
			args: {resource, options},
		});
	}
}
