import workerpool from "workerpool";
import path from "node:path";
import os from "node:os";
import fs from "graceful-fs";
import {promisify} from "node:util";
const mkdtemp = promisify(fs.mkdtemp);
const mkdir = promisify(fs.mkdir);
import {rimraf} from "rimraf";
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
	allResources,
	themeResources,
	options
}) {
	const pThemeResources = themeResources.map(createResource);
	const pAllResources = allResources.map(createResource);
	const tmpDirPath = await createTmpDir(options.projectName);
	const fsReader = await writeResourcesToDir(pAllResources, tmpDirPath);
	const wCollection = createWriterCollection({
		name: "zzzz",
		writerMapping: {
			"/resources/": fsReader,
		},
	});

	const result = await themeBuilder({
		resources: pThemeResources,
		fs: fsInterface(wCollection),
		options
		// options: {
		// 	compress,
		// 	cssVariables: !!cssVariables
		// }
	});

	// Cleanup
	// await rimraf(tmpDirPath);

	return result;
}

async function createTmpDir(projectName) {
	const sanitizedProjectName = projectName.replace(/[^A-Za-z0-9]/g, "");

	const tmpRootPath = path.join(os.tmpdir(), "ui5-tooling");
	await mkdir(tmpRootPath, {recursive: true});

	// Appending minus sign also because node docs advise to "avoid trailing X characters in prefix"
	return mkdtemp(path.join(tmpRootPath, `theme-build-${sanitizedProjectName}-`));
}

async function writeResourcesToDir(resources, targetPath) {
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
