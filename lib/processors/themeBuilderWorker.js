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
 * @param {object} parameters.allResources Array of Uint8Array transferable objects
 * 	with all the resources needed to build the css files. By nature those are @ui5/fs/Resource.
 * @param {object} parameters.themeResources Input array of Uint8Array transferable objects
 * 	that are the less sources to build upon. By nature those are @ui5/fs/Resource.
 * @param {object} parameters.options Less compiler options
 * @returns {Promise<Uint8Array[]>}
 */
export default async function execThemeBuild({
	allResources = [],
	themeResources = [],
	options = {}
}) {
	const fsThemeResources = themeResources.map((res) => {
		// res.transferable is an Uint8Array object and needs to be casted
		// to a Buffer in order to be read correctly.
		return createResource({path: res.path, buffer: Buffer.from(res.transferable)});
	});
	const fsAllResources = allResources.map((res) => {
		// res.transferable is an Uint8Array object and needs to be casted
		// to a Buffer in order to be read correctly.
		return createResource({path: res.path, buffer: Buffer.from(res.transferable)});
	});

	const fsReader = await addResourcesToCollection(fsAllResources);
	const wCollection = createWriterCollection({
		name: `theme builder worker - build resources collection`,
		writerMapping: {
			"/resources/": fsReader,
		},
	});

	const result = await themeBuilder({
		resources: fsThemeResources,
		fs: fsInterface(wCollection),
		options
	});

	return makeTransferableResource(result);
}

/**
 * Cast @ui5/fs/Resource into an Uint8Array transferable object
 *
 * @private
 * @param {@ui5/fs/Resource} resourceCollection
 * @returns {Promise<object>}
 */
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
