import {fileURLToPath} from "node:url";
import posixPath from "node:path/posix";
import {promisify} from "node:util";
import os from "node:os";
import workerpool from "workerpool";
import Resource from "@ui5/fs/Resource";
import {getLogger} from "@ui5/logger";
const log = getLogger("builder:processors:minifier");

const debugFileRegex = /((?:\.view|\.fragment|\.controller|\.designtime|\.support)?\.js)$/;

const MIN_WORKERS = 2;
const MAX_WORKERS = 4;
const osCpus = os.cpus().length || 1;
const maxWorkers = Math.max(Math.min(osCpus - 1, MAX_WORKERS), MIN_WORKERS);

const sourceMappingUrlPattern = /\/\/# sourceMappingURL=(.+)\s*$/;
const httpPattern = /^https?:\/\//i;

// Shared workerpool across all executions until the taskUtil cleanup is triggered
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

async function minifyInWorker(options, taskUtil) {
	return getPool(taskUtil).exec("execMinification", [options]);
}

async function getSourceMap(resource, readFile) {
	const resourceContent = await resource.getString();
	const resourcePath = resource.getPath();

	// This code is almost identical to lbt/bundle/Builder.js
	// Please try to update both places when making improvements or bug fixes

	const sourceMapUrlMatch = resourceContent.match(sourceMappingUrlPattern);
	if (sourceMapUrlMatch) {
		const sourceMapUrl = sourceMapUrlMatch[1];
		log.silly(`Found source map reference in content of resource ${resourcePath}: ${sourceMapUrl}`);

		// Strip sourceMappingURL from resource code to be minified
		// It has no effect and would be wrong if addSourceMappingUrl == true
		// In addition, as the debug-variant is created afterwards it does not have to take care to replace the comment
		resource.setString(resourceContent.replace(sourceMappingUrlPattern, ""));

		if (sourceMapUrl) {
			if (sourceMapUrl.startsWith("data:")) {
				// Data-URI indicates an inline source map
				const expectedTypeAndEncoding = "data:application/json;charset=utf-8;base64,";
				if (sourceMapUrl.startsWith(expectedTypeAndEncoding)) {
					const base64Content = sourceMapUrl.slice(expectedTypeAndEncoding.length);
					// Create a resource with a path suggesting it's the source map for the resource
					// (which it is but inlined)
					return Buffer.from(base64Content, "base64").toString();
				} else {
					log.warn(
						`Source map reference in resource ${resourcePath} is a data URI but has an unexpected` +
						`encoding: ${sourceMapUrl}. Expected it to start with ` +
						`"data:application/json;charset=utf-8;base64,"`);
				}
			} else if (httpPattern.test(sourceMapUrl)) {
				log.warn(`Source map reference in resource ${resourcePath} is an absolute URL. ` +
					`Currently, only relative URLs are supported.`);
			} else if (posixPath.isAbsolute(sourceMapUrl)) {
				log.warn(`Source map reference in resource ${resourcePath} is an absolute path. ` +
					`Currently, only relative paths are supported.`);
			} else {
				const sourceMapPath = posixPath.join(posixPath.dirname(resourcePath), sourceMapUrl);

				try {
					const sourceMapContent = await readFile(sourceMapPath);
					if (sourceMapContent) {
						return sourceMapContent.toString();
					} else {
						throw new Error(`Not found: ${sourceMapPath}`);
					}
				} catch (e) {
					// No input source map
					log.warn(`Unable to read source map for resource ${resourcePath}: ${e.message}`);
				}
			}
		}
	}
}

/**
 * @public
 * @module @ui5/builder/processors/minifier
 */

/**
 * Result set
 *
 * @public
 * @typedef {object} MinifierResult
 * @property {@ui5/fs/Resource} resource Minified resource
 * @property {@ui5/fs/Resource} dbgResource Debug (non-minified) variant
 * @property {@ui5/fs/Resource} sourceMap Source Map
 */

/**
 * Minifies the supplied resources.
 *
 * @public
 * @function default
 * @static
 *
 * @param {object} parameters Parameters
 * @param {@ui5/fs/Resource[]} parameters.resources List of resources to be processed
 * @param {fs|module:@ui5/fs/fsInterface} parameters.fs Node fs or custom
 *    [fs interface]{@link module:@ui5/fs/fsInterface}. Required when setting "parseSourceMappingUrl" to true
 * @param {@ui5/builder/tasks/TaskUtil|object} [parameters.taskUtil] TaskUtil instance.
 *    Required when using the <code>useWorkers</code> option
 * @param {object} [parameters.options] Options
 * @param {boolean} [parameters.options.parseSourceMappingUrl=false]
 *   Whether to use any existing source maps, either referenced in the resource or following the
 *   naming convention "<resource name>.map"
 * @param {boolean} [parameters.options.addSourceMappingUrl=true]
 *   Whether to add a sourceMappingURL reference to the end of the minified resource
 * @param {boolean} [parameters.options.useWorkers=false]
 *  Whether to offload the minification task onto separate CPU threads. This often speeds up the build process
 * @returns {Promise<module:@ui5/builder/processors/minifier~MinifierResult[]>}
 *   Promise resolving with object of resource, dbgResource and sourceMap
 */
export default async function({
	resources, fs, taskUtil, options: {parseSourceMappingUrl = false, addSourceMappingUrl = true, useWorkers = false
	} = {}}) {
	let minify;
	if (parseSourceMappingUrl && !fs) {
		throw new Error(`Option 'parseSourceMappingUrl' requires parameter 'fs' to be provided`);
	}

	if (useWorkers) {
		if (!taskUtil) {
			// TaskUtil is required for worker support
			throw new Error(`Minifier: Option 'useWorkers' requires a taskUtil instance to be provided`);
		}
		minify = minifyInWorker;
	} else {
		// Do not use workerpool
		minify = (await import("./minifierWorker.js")).default;
	}

	return Promise.all(resources.map(async (resource) => {
		const resourcePath = resource.getPath();
		const dbgPath = resourcePath.replace(debugFileRegex, "-dbg$1");
		const dbgFilename = posixPath.basename(dbgPath);

		const filename = posixPath.basename(resource.getPath());

		const sourceMapOptions = {
			filename
		};
		if (addSourceMappingUrl) {
			sourceMapOptions.url = filename + ".map";
		}
		let dbgSourceMapResource;
		if (resource.getSourceMetadata()?.contentModified) {
			log.info(
				`Resource has been modified by previous build tasks. ` +
				`Any referenced source map will be ignored since it might be corrupt: ${resourcePath}`);
		} else if (parseSourceMappingUrl) {
			// Try to find a source map reference in the to-be-minified resource
			// If we find one, provide it to terser as an input source map and keep using it for the
			// debug variant of the resource
			const sourceMapContent = await getSourceMap(resource, promisify(fs.readFile));


			if (sourceMapContent) {
				// Provide source map to terser as "input source map"
				sourceMapOptions.content = sourceMapContent;

				// Also use the source map for the debug variant of the resource
				// First update the file reference within the source map
				const sourceMapJson = JSON.parse(sourceMapContent);
				sourceMapJson.file = dbgFilename;

				// Then create a new resource
				dbgSourceMapResource = new Resource({
					string: JSON.stringify(sourceMapJson),
					path: dbgPath + ".map"
				});
			}
		}

		const dbgResource = await resource.clone();
		dbgResource.setPath(dbgPath);
		const code = await resource.getString();

		if (dbgSourceMapResource) {
			dbgResource.setString(code + `\n//# sourceMappingURL=${dbgFilename}.map`);
		}

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
		return {resource, dbgResource, sourceMapResource, dbgSourceMapResource};
	}));
}
