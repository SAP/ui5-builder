import workerpool from "workerpool";
import themeBuilder from "./themeBuilder.js";
import fsInterface from "@ui5/fs/fsInterface";
import {createAdapter, createWriterCollection, createResource} from "@ui5/fs/resourceFactory";
import FileSystem from "@ui5/fs/adapters/FileSystem";

/**
 * Task to build library themes.
 *
 * @private
 * @function default
 * @static
 *
 * @param {object} parameters Parameters
 * @param {object} parameters.themeResources
 * @param {object} parameters.options
 * @returns {Promise<resources>}
 */
export default async function execThemeBuild({
	themeResources,
	options
}) {
	const dependencies = new FileSystem({
		virBasePath: "/resources/",
		fsBasePath: options.tempDir
	});
	const pThemeResources = await Promise.all(themeResources.map(async (resPath) => dependencies.byPath(resPath)));

	const result = await themeBuilder({
		resources: pThemeResources,
		fs: fsInterface(dependencies),
		options
	});

	return makeTransferableResource(result);
}

async function makeTransferableResource(resourceCollection) {
	return Promise.all(
		resourceCollection.map(async (res) => {
			return {
				string: await res.getString(),
				name: res.getName(),
				path: res.getPath(),
			};
		})
	);
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
