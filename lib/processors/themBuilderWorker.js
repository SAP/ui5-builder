import workerpool from "workerpool";
import themeBuilder from "./themeBuilder.js";
import fsInterface from "@ui5/fs/fsInterface";

/**
 * Task to build library themes.
 *
 * @private
 * @function default
 * @static
 *
 * @param {object} parameters Parameters
 * @param {object} parameters.allResources
 * @param {object} parameters.combo
 * @param {object} parameters.options
 * @returns {Promise<resources>}
 */
export default async function execThemeBuild({
	allResources,
	combo,
	options
}) {
	return await themeBuilder({
		resources: allResources,
		fs: fsInterface(combo),
		options
		// options: {
		// 	compress,
		// 	cssVariables: !!cssVariables
		// }
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
