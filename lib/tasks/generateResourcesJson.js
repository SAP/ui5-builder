"use strict";

// const log = require("@ui5/logger").getLogger("builder:tasks:generateResourcesJson");
const resourceListCreator = require("../processors/resourceListCreator");

const DEFAULT_EXCLUDES = [
	"!**/.DS_Store",
	"!**/.eslintrc",
	"!**/.eslintignore",
	"!**/.gitignore"
];

function getCreatorOptions(taskOptions) {
	const creatorOptions = {};
	if ( taskOptions.projectName === "sap.ui.core" ) {
		Object.assign(creatorOptions, {
			externalResources: {
				"sap/ui/core": [
					"*",
					"sap/base/",
					"sap/ui/"
				]
			},
			mergedResourcesFilters: [
				"jquery-sap*.js",
				"sap-ui-core*.js",
				"**/Component-preload.js",
				"**/library-preload.js",
				"**/library-preload-dbg.js",
				"**/library-preload.json",
				"**/library-all.js",
				"**/library-all-dbg.js",
				"**/designtime/library-preload.designtime.js",
				"**/library-preload.support.js"
			].join(",")
		});
	}
	return creatorOptions;
}

/**
 * Task for creating a library resources.json, describing all productive resources in the library.
 *
 * @public
 * @alias module:@ui5/builder.tasks.generateResourcesJson
 * @param {object} parameters Parameters
 * @param {module:@ui5/fs.DuplexCollection} parameters.workspace DuplexCollection to read and write files
 * @param {module:@ui5/fs.AbstractReader} parameters.dependencies Reader or Collection to read dependency files
 * @param {object} parameters.options Options
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
	}, getCreatorOptions(options)).then((resourceLists) =>
		Promise.all(
			resourceLists.map((resourceList) => workspace.write(resourceList))
		)
	);
};
