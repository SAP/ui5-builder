const path = require("path");
const makeDir = require("make-dir");
const fs = require("graceful-fs");
const tmp = require("tmp");
tmp.setGracefulCleanup();
const jsdocGenerator = require("../processors/jsdoc/jsdocGenerator");
const {resourceFactory} = require("@ui5/fs");

/**
 * Task to create dbg files.
 *
 * @module builder/tasks/createDebugFiles
 * @param {Object} parameters Parameters
 * @param {DuplexCollection} parameters.workspace DuplexCollection to read and write files
 * @param {Object} parameters.options Options
 * @param {string} parameters.options.pattern Pattern to locate the files to be processed
 * @param {string} parameters.options.projectName Project name
 * @param {string} parameters.options.version Project version
 * @param {boolean} [parameters.options.sdkBuild=true] Whether additional SDK specific api.json resources shall be generated
 * @returns {Promise<undefined>} Promise resolving with <code>undefined</code> once data has been written
 */
module.exports = async function({workspace, options}) {
	if (!options.projectName || !options.version || !options.pattern) {
		throw new Error("[generateJsdoc]: One or more mandatory options not provided");
	}

	let allResources;
	if (workspace.byGlobSource) { // API only available on duplex collections
		allResources = await workspace.byGlobSource(options.pattern);
	} else {
		allResources = await workspace.byGlob(options.pattern);
	}

	const {path: tmpDirPath, cleanupCallback} = await createTmpWorkDir(options.projectName);
	const tmpSourcePath = path.join(tmpDirPath, "src"); // dir will be created by writing project resources below
	const tmpTargetPath = path.join(tmpDirPath, "target"); // dir will be created by jsdoc itself
	const tmpTmpPath = path.join(tmpDirPath, "tmp"); // dir needs to be created by us

	await makeDir(tmpTmpPath, {fs});

	const fsSource = resourceFactory.createAdapter({
		fsBasePath: tmpSourcePath,
		virBasePath: "/resources/"
	});

	// write all resources to the tmp folder
	await Promise.all(allResources.map((resource) => fsSource.write(resource)));

	const createdResources = await jsdocGenerator({
		sourcePath: tmpSourcePath,
		targetPath: tmpTargetPath,
		tmpPath: tmpTmpPath,
		options: {
			projectName: options.projectName,
			version: options.version,
			variants: ["apijson"]
		}
	});

	console.log(createdResources);
	await Promise.all(createdResources.map((resource) => {
		return workspace.write(resource);
		// TODO: cleanupCallback
	}));
};

function createTmpWorkDir(projectName) {
	return new Promise((resolve, reject) => {
		tmp.dir({
			prefix: `ui5-tooling-tmp-jsdoc-${projectName}-`
		}, (err, path, cleanupCallback) => {
			if (err) {
				reject(err);
				return;
			}

			resolve({
				path,
				cleanupCallback
			});
		});
	});
}
