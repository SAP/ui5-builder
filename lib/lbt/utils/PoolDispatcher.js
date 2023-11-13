import workerpool from "workerpool";
import os from "node:os";
import {fileURLToPath} from "node:url";
import {getLogger} from "@ui5/logger";

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
 * "@ui5/fs/fsInterface" like class that uses internally
 * "@ui5/fs/fsInterface", implements its methods, and
 * sends the results to a MessagePort.
 *
 * Used in the main thread in a combination with FsWorkerThreadInterface.
 */
export class FsMainThreadInterface {
	#comPorts = new Set();
	#fsInterfaceReader = null;
	#cache = Object.create(null);

	/**
	 * Constructor
	 *
	 * @param {@ui5/fs/fsInterface} fsInterfaceReader Reader for the Resources
	 */
	constructor(fsInterfaceReader) {
		if (!fsInterfaceReader) {
			throw new Error("fsInterfaceReader is mandatory argument");
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
	#onMessage(e, comPort) {
		switch (e.action) {
			case "readFile":
				this.#doRequest(comPort, {
					action: "readFile",
					fsPath: e.fsPath,
					options: e.options,
				});
				break;
			case "stat":
				this.#doRequest(comPort, { action: "stat", fsPath: e.fsPath });
				break;
		}
	}

	/**
	 * Requests a Resource from the "@ui5/fs/fsInterface" and sends it to the worker threads
	 * via postMessage.
	 *
	 * @param {MessagePort} comPort The communication channel
	 * @param {object} parameters
	 * @param {string} parameters.action Action to perform. Corresponds to the names of
	 * 	the public methods of "@ui5/fs/fsInterface" and triggers this method of the
	 *	"@ui5/fs/fsInterface" instance.
	 * @param {string} parameters.fsPath Path of the Resource
	 * @param {object} parameters.options Options for "readFile" action
	 */
	async #doRequest(comPort, { action, fsPath, options }) {
		const cacheKey = `${fsPath}-${action}`;
		if (!this.#cache[cacheKey]) {
			this.#cache[cacheKey] = new Promise((res) => {
				if (action === "readFile") {
					this.#fsInterfaceReader.readFile(
						fsPath,
						options,
						(error, result) => res({ error, result })
					);
				} else if (action === "stat") {
					this.#fsInterfaceReader.stat(fsPath, (error, result) =>
						// The Stat object has some special methods that sometimes cannot be serialized
						// properly in the postMessage. In this scenario, we do not need those methods,
						// but just to check whether stats has resolved to something.
						res(JSON.parse(JSON.stringify({ error, result })))
					);
				} else {
					res({
						error: new Error(
							`Action "${action}" is not available.`
						),
						result: null,
					});
				}
			});
		}

		const fromCache = await this.#cache[cacheKey];
		comPort.postMessage({ action, fsPath, ...fromCache });
	}
}

/**
 * "@ui5/fs/fsInterface" like class that uses internally
 * "@ui5/fs/fsInterface", implements its methods, and
 * requests resources via MessagePort.
 *
 * Used in the worker thread in a combination with FsMainThreadInterface.
 */
export class FsWorkerThreadInterface {
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
		const cbObject = this.#callbacks.find(
			(cb) => cb.action === e.action && cb.fsPath === e.fsPath
		);

		if (cbObject) {
			this.#cache[`${e.fsPath}-${e.action}`] = {
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
	#doRequest({ action, fsPath, options }, callback) {
		const cacheKey = `${fsPath}-${action}`;

		if (this.#cache[cacheKey]) {
			const { result, error } = this.#cache[cacheKey];
			callback(error, result);
		} else {
			this.#callbacks.push({ action, fsPath, callback });
			this.#comPort.postMessage({ action, fsPath, options });
		}
	}

	readFile(fsPath, options, callback) {
		this.#doRequest({ action: "readFile", fsPath, options }, callback);
	}

	stat(fsPath, callback) {
		this.#doRequest({ action: "stat", fsPath }, callback);
	}
}
