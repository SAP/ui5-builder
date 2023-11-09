import workerpool from "workerpool";
import os from "node:os";
import {getLogger} from "@ui5/logger";
const log = getLogger("builder:processors:minifier");

const MIN_WORKERS = 2;
const MAX_WORKERS = 4;
const osCpus = os.cpus().length || 1;
const maxWorkers = Math.max(Math.min(osCpus - 1, MAX_WORKERS), MIN_WORKERS);

class Parallelizer {
	#log;

	constructor() {

	}
	
	getInstance() {
		
	}
}

let pool;
function getPool(taskUtil) {
	if (!pool) {
		log.verbose(`Creating workerpool with up to ${maxWorkers} workers (available CPU cores: ${osCpus})`);
		const workerPath = fileURLToPath(new URL("./minifierWorker.js", import.meta.url));
		pool = workerpool.pool(workerPath, {
			workerType: "auto",
			maxWorkers
		});
		taskUtil.registerCleanupTask(() => {
			log.verbose(`Terminating workerpool`);
			const poolToBeTerminated = pool;
			pool = null;
			poolToBeTerminated.terminate();
		});
	}
	return pool;
}