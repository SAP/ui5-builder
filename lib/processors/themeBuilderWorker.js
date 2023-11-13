import workerpool from "workerpool";
import themeBuilder from "./themeBuilder.js";
import {deserializeResources, serializeResources, FsWorkerThreadInterface} from "../lbt/utils/PoolDispatcher.js";

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

// Test execution via ava is never done on the main thread
/* istanbul ignore else */
if (!workerpool.isMainThread) {
	// Script got loaded through workerpool
	// => Create a worker and register public functions
	workerpool.worker({
		execThemeBuild
	});
}
