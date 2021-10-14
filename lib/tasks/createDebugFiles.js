const dbg = require("../processors/debugFileCreator");
const fsInterface = require("@ui5/fs").fsInterface;

/**
 * Task to create dbg files.
 *
 * @public
 * @alias module:@ui5/builder.tasks.createDebugFiles
 * @param {object} parameters Parameters
 * @param {module:@ui5/fs.DuplexCollection} parameters.workspace DuplexCollection to read and write files
 * @param {module:@ui5/builder.tasks.TaskUtil|object} [parameters.taskUtil] TaskUtil
 * @param {object} parameters.options Options
 * @param {string} parameters.options.pattern Pattern to locate the files to be processed
 * @returns {Promise<undefined>} Promise resolving with <code>undefined</code> once data has been written
 */
module.exports = async function({workspace, taskUtil, options: {pattern}}) {
	let allResources;
	if (workspace.byGlobSource) { // API only available on duplex collections
		allResources = await workspace.byGlobSource(pattern);
	} else {
		allResources = await workspace.byGlob(pattern);
	}
	return dbg({
		fs: fsInterface(workspace),
		resources: allResources
	}).then((processedResources) => {
		return Promise.all(processedResources.map((resource) => {
			if (taskUtil) {
				taskUtil.setTag(resource, taskUtil.STANDARD_TAGS.IsDebugVariant);
			}
			return workspace.write(resource);
		}));
	});
};
