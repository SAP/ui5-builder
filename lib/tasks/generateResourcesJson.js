"use strict";

// const log = require("@ui5/logger").getLogger("builder:tasks:generateResourcesJson");
const resourceListCreator = require("../processors/resourceListCreator");

const DEFAULT_EXCLUDES = [
	"!**/.DS_Store",
	"!**/.eslintrc",
	"!**/.eslintignore",
	"!**/.gitignore"
];

/**
 * Task for creating a library resources.json, describing all productive resources in the library.
 *
 * @public
 * @alias module:@ui5/builder.tasks.generateResourcesJson
 * @param {Object} parameters Parameters
 * @param {module:@ui5/fs.DuplexCollection} parameters.workspace DuplexCollection to read and write files
 * @param {module:@ui5/fs.AbstractReader} parameters.dependencies Reader or Collection to read dependency files
 * @param {Object} parameters.options Options
 * @param {string} parameters.options.projectName Project name
 * @returns {Promise<undefined>} Promise resolving with <code>undefined</code> once data has been written
 */
module.exports = async function({workspace, dependencies, options}) {
	let resources;
	if (workspace.byGlobSource) { // API only available on duplex collections
		resources = await workspace.byGlobSource(["/resources/**/*.*", ...DEFAULT_EXCLUDES]);
		// HACK add resources from internal writer of workspace
		const writtenResources = await workspace._writer.byGlob(["/resources/**/*.*", ...DEFAULT_EXCLUDES]);
		writtenResources.forEach((res) => {
			if ( resources.indexOf(res) < 0 ) {
				resources.push(res);
			}
		});
	} else {
		resources = await workspace.byGlob(["/resources/**/*.*", ...DEFAULT_EXCLUDES]);
	}
	const dependencyResources = await dependencies.byGlob("/resources/**/*.{js,json,xml,html,properties,library}");

	return resourceListCreator({
		resources,
		dependencyResources
	}).then((resourceLists) =>
		Promise.all(
			resourceLists.map((resourceList) => workspace.write(resourceList))
		)
	);
};
