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
 * @public
 * @alias module:@ui5/builder.tasks.generateJsdoc
 * @param {Object} parameters Parameters
 * @param {module:@ui5/fs.DuplexCollection} parameters.workspace DuplexCollection to read and write files
 * @param {Object} parameters.options Options
 * @param {string} parameters.options.pattern Pattern to locate the files to be processed
 * @param {string} parameters.options.projectName Project name
 * @param {string} parameters.options.version Project version
 * @param {boolean} [parameters.options.sdkBuild=true] Whether additional SDK specific api.json
 *														resources shall be generated
 * @returns {Promise<undefined>} Promise resolving with <code>undefined</code> once data has been written
 */
const generateJsdoc = async function({workspace, options}) {
	if (!options.projectName || !options.version || !options.pattern) {
		throw new Error("[generateJsdoc]: One or more mandatory options not provided");
	}

	const {sourcePath: resourcePath, targetPath, tmpPath} = await createTmpDirs(options.projectName);

	await writeResourcesToDir({
		workspace,
		pattern: options.pattern,
		targetPath: resourcePath
	});

	const createdResources = await jsdocGenerator({
		sourcePath: resourcePath,
		targetPath,
		tmpPath,
		options: {
			projectName: options.projectName,
			version: options.version,
			variants: ["apijson"]
		}
	});

	await Promise.all(createdResources.map(async (resource) => {
		await workspace.write(resource);
	}));
};


/**
 * Create temporary directories for JSDoc generation processor
 *
 * @private
 * @param {string} projectName Project name used for naming the temporary working directory
 * @returns {Promise<Object>} Promise resolving with sourcePath, targetPath and tmpPath strings
 */
async function createTmpDirs(projectName) {
	const {path: tmpDirPath} = await createTmpDir(projectName);

	const sourcePath = path.join(tmpDirPath, "src"); // dir will be created by writing project resources below
	const targetPath = path.join(tmpDirPath, "target"); // dir will be created by jsdoc itself

	const tmpPath = path.join(tmpDirPath, "tmp"); // dir needs to be created by us
	await makeDir(tmpPath, {fs});

	return {
		sourcePath,
		targetPath,
		tmpPath
	};
}

/**
 * Create a temporary directory on the host system
 *
 * @private
 * @param {string} projectName Project name used for naming the temporary directory
 * @returns {Promise<Object>} Promise resolving with path of the temporary directory
 */
function createTmpDir(projectName) {
	return new Promise((resolve, reject) => {
		tmp.dir({
			prefix: `ui5-tooling-tmp-jsdoc-${projectName}-`,
			// keep: true,
			unsafeCleanup: true
		}, (err, path) => {
			if (err) {
				reject(err);
				return;
			}

			resolve({
				path
			});
		});
	});
}

/**
 * Write resources from workspace matching the given pattern to the given fs destination
 *
 * @private
 * @param {Object} parameters Parameters
 * @param {module:@ui5/fs.DuplexCollection} parameters.workspace DuplexCollection to read and write files
 * @param {string} parameters.pattern Pattern to match resources in workspace against
 * @param {string} parameters.targetPath Path to write the resources to
 * @returns {Promise<undefined>} Promise resolving with <code>undefined</code> once data has been written
 */
async function writeResourcesToDir({workspace, pattern, targetPath}) {
	const fsSource = resourceFactory.createAdapter({
		fsBasePath: targetPath,
		virBasePath: "/resources/"
	});

	let allResources;
	if (workspace.byGlobSource) { // API only available on duplex collections
		allResources = await workspace.byGlobSource(pattern);
	} else {
		allResources = await workspace.byGlob(pattern);
	}
	// write all resources to the tmp folder
	await Promise.all(allResources.map((resource) => fsSource.write(resource)));
}

module.exports = generateJsdoc;
module.exports._createTmpDirs = createTmpDirs;
module.exports._createTmpDir = createTmpDir;
module.exports._writeResourcesToDir = writeResourcesToDir;
