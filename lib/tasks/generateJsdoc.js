const path = require("path");
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
 * @param {Object} [parameters.options] Options
 * @param {string} [parameters.options.pattern] Pattern to locate the files to be processed
 * @returns {Promise<undefined>} Promise resolving with <code>undefined</code> once data has been written
 */
module.exports = async function({workspace, options}) {
	let allResources;
	if (workspace.byGlobSource) { // API only available on duplex collections
		allResources = await workspace.byGlobSource(options.pattern);
	} else {
		allResources = await workspace.byGlob(options.pattern);
	}

	const {path: tmpDirPath, cleanupCallback} = await createTmpWorkDir();
	const tmpSourcePath = path.join(tmpDirPath, "src");
	const tmpTargetPath = path.join(tmpDirPath, "target");

	const fsSource = resourceFactory.createAdapter({
		fsBasePath: tmpSourcePath,
		virBasePath: "/resources/"
	});

	// write all resources to the tmp folder
	await Promise.all(allResources.map((resource) => fsSource.write(resource)));

	const createdResources = await jsdocGenerator({
		sourcePath: tmpSourcePath,
		targetPath: tmpTargetPath,
		options
	});

	console.log(createdResources);
	await Promise.all(createdResources.map((resource) => {
		return workspace.write(resource);
		// TODO: cleanupCallback
	}));
};

function createTmpWorkDir() {
	return new Promise((resolve, reject) => {
		tmp.dir({
			prefix: "ui5-tooling-jsdoc-tmp-"
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
