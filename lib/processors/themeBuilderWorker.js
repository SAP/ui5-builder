import workerpool from "workerpool";
import path from "node:path";
import os from "node:os";
import fs from "graceful-fs";
import {promisify} from "node:util";
const mkdtemp = promisify(fs.mkdtemp);
const mkdir = promisify(fs.mkdir);
import themeBuilder from "./themeBuilder.js";
import fsInterface from "@ui5/fs/fsInterface";
import {createAdapter, createWriterCollection, createResource} from "@ui5/fs/resourceFactory";
import {performance} from "node:perf_hooks";

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
	allResources,
	themeResources,
	options
}) {
	const timer = performance.now();

	const pThemeResources = themeResources.map(createResource);
	const pAllResources = allResources.map(createResource);
	const tmpDirPath = ""; // await createTmpDir(options.projectName);
	const fsReader = await addResourcesToCollection(pAllResources, tmpDirPath);
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

	// Cleanup
	// await rimraf(tmpDirPath);

	return makeTransferableResource(result);
}

async function makeTransferableResource(resourceCollection) {
	return Promise.all(
		resourceCollection.map(async (res) => {
			return {
				// project: projectName,
				// statInfo: res.getStatInfo(),
				// buffer: await res.getBuffer(),
				// buffer: await res.getBuffer(),
				string: await res.getString(),
				name: res.getName(),
				path: res.getPath(),
			};
		})
	);
}

async function createTmpDir(projectName) {
	const sanitizedProjectName = projectName.replace(/[^A-Za-z0-9]/g, "");

	const tmpRootPath = path.join(os.tmpdir(), "ui5-tooling");
	await mkdir(tmpRootPath, {recursive: true});

	// Appending minus sign also because node docs advise to "avoid trailing X characters in prefix"
	return mkdtemp(path.join(tmpRootPath, `theme-build-${sanitizedProjectName}-`));
}

async function addResourcesToCollection(resources, targetPath) {
	const fsTarget = createAdapter({
		// fsBasePath: targetPath,
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
