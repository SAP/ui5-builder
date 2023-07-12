import workerpool from "workerpool";
import themeBuilder from "./themeBuilder.js";
import fsInterface from "@ui5/fs/fsInterface";
import {createAdapter, createWriterCollection, createResource} from "@ui5/fs/resourceFactory";
import {Buffer} from "node:buffer";

/**
 * Task to build library themes.
 *
 * @private
 * @function default
 * @static
 *
 * @param {object} parameters Parameters
 * @param {object[]} parameters.allResources Array of Uint8Array transferable objects
 * 	with all the resources needed to build the css files. By nature those are @ui5/fs/Resource.
 * @param {object[]} parameters.themeResources Input array of Uint8Array transferable objects
 * 	that are the less sources to build upon. By nature those are @ui5/fs/Resource.
 * @param {object} parameters.options Less compiler options
 * @returns {Promise<object[]>} Resulting array of Uint8Array transferable objects
 */
export default async function execThemeBuild({
	allResources = [],
	themeResources = [],
	options = {}
}) {
	const fsThemeResources = uint8ToResources(themeResources);
	const fsAllResources = uint8ToResources(allResources);

	const fsReader = await createResourcesCollection(fsAllResources);
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
 * Casts @ui5/fs/Resource-s into an Uint8Array transferable object
 *
 * @param {@ui5/fs/Resource[]} resourceCollection
 * @returns {Promise<object[]>}
 */
export async function makeTransferableResource(resourceCollection) {
	return Promise.all(
		resourceCollection.map(async (res) => ({
			transferable: await res.getBuffer(),
			path: res.getPath()
		}))
	);
}

/**
 * Casts Uint8Array into @ui5/fs/Resource-s transferable object
 *
 * @param {Promise<object[]>} resources
 * @returns {@ui5/fs/Resource[]}
 */
export function uint8ToResources(resources) {
	return resources.map((res) => {
		// res.transferable is an Uint8Array object and needs to be cast
		// to a Buffer in order to be read correctly.
		return createResource({path: res.path, buffer: Buffer.from(res.transferable)});
	});
}

async function createResourcesCollection(resources) {
	const memoryAdapter = createAdapter({
		virBasePath: "/resources/"
	});

	// write all resources to the tmp folder
	await Promise.all(resources.map((resource) => memoryAdapter.write(resource)));
	return memoryAdapter;
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
