const log = require("@ui5/logger").getLogger("builder:processors:minifier");
const path = require("path");
const os = require("os");
const Resource = require("@ui5/fs").Resource;
const workerpool = require("workerpool");

const debugFileRegex = /((?:\.view|\.fragment|\.controller|\.designtime|\.support)?\.js)$/;

const MIN_WORKERS = 2;
const MAX_WORKERS = 4;
const osCpus = os.cpus().length || 1;
const maxWorkers = Math.max(Math.min(osCpus - 1, MAX_WORKERS), MIN_WORKERS);

// Shared workerpool across all executions until the taskUtil cleanup is triggered
let pool;

function getPool(taskUtil) {
	if (!pool) {
		log.info(`Creating workerpool with up to ${maxWorkers} workers (CPUs: ${osCpus})`);
		pool = workerpool.pool(__dirname + "/minifierWorker.js", {
			workerType: "auto",
			maxWorkers
		});
		taskUtil.registerCleanupTask(() => {
			log.info(`Terminating workerpool`);
			const poolToBeTerminated = pool;
			pool = null;
			poolToBeTerminated.terminate();
		});
	}
	return pool;
}

async function minifyInWorker(options, taskUtil) {
	return getPool(taskUtil).exec("minify", [options]);
}

/**
 * Result set
 *
 * @public
 * @typedef {object} MinifierResult
 * @property {module:@ui5/fs.Resource} resource Minified resource
 * @property {module:@ui5/fs.Resource} dbgResource Debug (non-minified) variant
 * @property {module:@ui5/fs.Resource} sourceMap Source Map
 * @memberof module:@ui5/builder.processors
 */

/**
 * Minifies the supplied resources.
 *
 * @public
 * @alias module:@ui5/builder.processors.minifier
 * @param {object} parameters Parameters
 * @param {module:@ui5/fs.Resource[]} parameters.resources List of resources to be processed
 * @param {module:@ui5/builder.tasks.TaskUtil|object} [parameters.taskUtil] TaskUtil
 * @param {object} [parameters.options] Options
 * @param {boolean} [parameters.options.addSourceMappingUrl=true]
 * 				Whether to add a sourceMappingURL reference to the end of the minified resource
 * @returns {Promise<module:@ui5/builder.processors.MinifierResult[]>}
 * 				Promise resolving with object of resource, dbgResource and sourceMap
 */
module.exports = async function({resources, taskUtil, options: {addSourceMappingUrl = true} = {}}) {
	let minify;
	if (!taskUtil) {
		// TaskUtil is required for worker support
		minify = require("./minifierWorker");
	} else {
		minify = minifyInWorker;
	}

	return Promise.all(resources.map(async (resource) => {
		const dbgPath = resource.getPath().replace(debugFileRegex, "-dbg$1");
		const dbgResource = await resource.clone();
		dbgResource.setPath(dbgPath);

		const filename = path.posix.basename(resource.getPath());
		const code = await resource.getString();
		const sourceMapOptions = {
			filename
		};
		if (addSourceMappingUrl) {
			sourceMapOptions.url = filename + ".map";
		}
		const dbgFilename = path.posix.basename(dbgPath);

		const result = await minify({
			filename,
			dbgFilename,
			code,
			sourceMapOptions
		}, taskUtil);
		resource.setString(result.code);
		const sourceMapResource = new Resource({
			path: resource.getPath() + ".map",
			string: result.map
		});
		return {resource, dbgResource, sourceMapResource};
	}));
};
