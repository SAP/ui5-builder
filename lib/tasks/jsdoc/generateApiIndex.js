const ui5Fs = require("@ui5/fs");
const ReaderCollectionPrioritized = ui5Fs.ReaderCollectionPrioritized;
const fsInterface = ui5Fs.fsInterface;
const apiIndexGenerator = require("../../processors/jsdoc/apiIndexGenerator");

/**
 * Compiles an api-index.json resource from all available api.json resources as created by the
 * [executeJsdocSdkTransformation]{@link module:@ui5/builder.tasks.executeJsdocSdkTransformation} task.
 * The resulting api-index.json resource is mainly to be used in the SDK.
 *
 * @public
 * @alias module:@ui5/builder.tasks.generateApiIndex
 * @param {Object} parameters Parameters
 * @param {module:@ui5/fs.DuplexCollection} parameters.workspace DuplexCollection to read and write files
 * @param {module:@ui5/fs.AbstractReader} parameters.dependencies Reader or Collection to read dependency files
 * @param {Object} parameters.options Options
 * @param {string} parameters.options.projectName Project name
 * @returns {Promise<undefined>} Promise resolving with <code>undefined</code> once data has been written
 */
module.exports = async function({workspace, dependencies, options}) {
	if (!options || !options.projectName) {
		throw new Error("[generateApiIndex]: One or more mandatory options not provided");
	}
	const combo = new ReaderCollectionPrioritized({
		name: `generateApiIndex - workspace + dependencies: ${options.projectName}`,
		readers: [workspace, dependencies]
	});

	const versionInfoFile = "/resources/sap-ui-version.json";
	const unpackedTestresourcesRoot = "/test-resources";
	const targetFile = "/docs/api/api-index.json";
	const targetFileDeprecated = "/docs/api/api-index-deprecated.json";
	const targetFileExperimental = "/docs/api/api-index-experimental.json";
	const targetFileSince = "/docs/api/api-index-since.json";

	const createdResources = await apiIndexGenerator({
		versionInfoFile,
		unpackedTestresourcesRoot,
		targetFile,
		targetFileDeprecated,
		targetFileExperimental,
		targetFileSince,
		fs: fsInterface(combo),
	});

	await Promise.all(createdResources.map((resource) => {
		return workspace.write(resource);
	}));
};
