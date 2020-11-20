const log = require("@ui5/logger").getLogger("builder:processors:uglifier");
const workerpool = require("workerpool");
let _pool;

const MIN_WORKERS = 2;
const MAX_WORKERS = 4;
const osCpus = require("os").cpus().length;
const maxWorkers = Math.max(Math.min((osCpus || 1) - 1, MAX_WORKERS), MIN_WORKERS);

function pool({taskUtil}) {
	if (!_pool) {
		log.info(`Creating workerpool with up to ${maxWorkers} workers (CPUs: ${osCpus})`);
		_pool = workerpool.pool(__dirname + "/uglifier_worker.js", {
			workerType: "auto",
			maxWorkers
		});
		taskUtil.registerCleanupTask(() => {
			log.info(`Terminating workerpool`);
			_pool.terminate();
			_pool = null;
		});
	}
	return _pool;
}

let uglifyWorker;

/**
 * Minifies the supplied resources.
 *
 * @public
 * @alias module:@ui5/builder.processors.uglifier
 * @param {object} parameters Parameters
 * @param {module:@ui5/fs.Resource[]} parameters.resources List of resources to be processed
 * @param {module:@ui5/builder.tasks.TaskUtil|object} [parameters.taskUtil] TaskUtil
 * @returns {Promise<module:@ui5/fs.Resource[]>} Promise resolving with uglified resources
 */
module.exports = function({resources, taskUtil}) {
	return Promise.all(resources.map(async (resource) => {
		const code = await resource.getString();
		let uglifiedCode;
		if (taskUtil) {
			uglifiedCode = await pool({taskUtil}).exec("uglify", [{
				filePath: resource.getPath(),
				code
			}]);
		} else {
			if (!uglifyWorker) {
				uglifyWorker = require("./uglifier_worker");
			}
			uglifiedCode = await uglifyWorker({
				filePath: resource.getPath(),
				code
			});
		}
		resource.setString(uglifiedCode);
		return resource;
	}));
};
