const resourceFactory = require("@ui5/fs").resourceFactory;
const createIndex = require("./lib/create-api-index");

/**
 * Compiles API index resources from all <code>api.json</code> resources available in the given test resources directory
 * as created by the [sdkTransformer]{@link module:@ui5/builder.processors.sdkTransformer} processor.
 * The resulting index resources (e.g. <code>api-index.json</code>,  <code>api-index-deprecated.json</code>,
 * <code>api-index-experimental.json</code> and <code>api-index-since.json</code>) are mainly to be used in the SDK.
 *
 * @public
 * @alias module:@ui5/builder.processors.apiIndexGenerator
 * @param {Object} parameters Parameters
 * @param {string} parameters.versionInfoFile Path to <code>sap-ui-version.json</code> resource
 * @param {string} parameters.unpackedTestresourcesRoot Path to <code>/test-resources</code> root directory in the
 *														given fs
 * @param {string} parameters.targetFile Path to create the generated API index JSON resource for
 * @param {string} parameters.targetFileDeprecated Path to create the generated API index "deprecated" JSON resource for
 * @param {string} parameters.targetFileExperimental Path to create the generated API index "experimental" JSON
 *														resource for
 * @param {string} parameters.targetFileSince Path to create the generated API index "since" JSON resource for
 * @param {fs|module:@ui5/fs.fsInterface} parameters.fs Node fs or
 * 				custom [fs interface]{@link module:resources/module:@ui5/fs.fsInterface} to use
 * @returns {Promise<module:@ui5/fs.Resource[]>} Promise resolving with created resources <code>api-index.json</code>,
 * <code>api-index-deprecated.json</code>, <code>api-index-experimental.json</code> and
 * <code>api-index-since.json</code> (names depend on the supplied paths)
 */
const apiIndexGenerator = async function({
	versionInfoFile, unpackedTestresourcesRoot, targetFile, targetFileDeprecated, targetFileExperimental,
	targetFileSince, fs
}) {
	if (!versionInfoFile || !unpackedTestresourcesRoot || !targetFile || !targetFileDeprecated ||
			!targetFileExperimental || !targetFileSince || !fs) {
		throw new Error("[apiIndexGenerator]: One or more mandatory parameters not provided");
	}

	const resourceMap = await createIndex(versionInfoFile, unpackedTestresourcesRoot, targetFile,
		targetFileDeprecated, targetFileExperimental, targetFileSince, {
			fs,
			returnOutputFiles: true
		});

	return Object.keys(resourceMap).map((resPath) => {
		return resourceFactory.createResource({
			path: resPath,
			string: resourceMap[resPath]
		});
	});
};

module.exports = apiIndexGenerator;
