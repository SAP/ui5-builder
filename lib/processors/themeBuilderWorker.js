import workerpool from "workerpool";
import themeBuilder from "./themeBuilder.js";
import fsInterface from "@ui5/fs/fsInterface";
import {createAdapter, createWriterCollection, createResource} from "@ui5/fs/resourceFactory";

/**
 * Task to build library themes.
 *
 * @private
 * @function default
 * @static
 *
 * @param {object} parameters Parameters
 * @param {object} parameters.allResources
 * @param {object} parameters.themeResources
 * @param {object} parameters.options
 * @returns {Promise<resources>}
 */
export default async function execThemeBuild({
	allResources = [],
	themeResources = [],
	options = {}
}) {
	const pThemeResources = themeResources.map((res) => {
		// res.transferable is an Uint8Array object and needs to be casted
		// to a Buffer in order to be read correctly.
		return createResource({path: res.path, buffer: Buffer.from(res.transferable)});
	});
	const pAllResources = allResources.map((res) => {
		// res.transferable is an Uint8Array object and needs to be casted
		// to a Buffer in order to be read correctly.
		return createResource({path: res.path, buffer: Buffer.from(res.transferable)});
	});

	const fsReader = await addResourcesToCollection(pAllResources);
	const wCollection = createWriterCollection({
		name: `theme builder worker- build resources collection`,
		writerMapping: {
			"/resources/": fsReader,
		},
	});

	const result = await themeBuilder({
		resources: pThemeResources,
		fs: fsInterface(wCollection),
		options
	});

	return makeTransferableResource(result);
}

async function makeTransferableResource(resourceCollection) {
	return Promise.all(
		resourceCollection.map(async (res) => ({
			transferable: await res.getBuffer(),
			path: res.getPath()
		}))
	);
}

async function addResourcesToCollection(resources) {
	const fsTarget = createAdapter({
		virBasePath: "/resources/"
	});

	// write all resources to the tmp folder
	await Promise.all(resources.map((resource) => fsTarget.write(resource)));
	return fsTarget;
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
