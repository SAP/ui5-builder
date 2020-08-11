"use strict";

// const log = require("@ui5/logger").getLogger("builder:tasks:generateResourcesJson");
const resourceListCreator = require("../processors/resourceListCreator");

function getCreatorOptions(projectName) {
	const creatorOptions = {};
	if ( projectName === "sap.ui.core" ) {
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
 * @param {object} parameters.options Options with property <code>projectName</code>
 * @returns {Promise<undefined>} Promise resolving with <code>undefined</code> once data has been written
 */
module.exports = async function({workspace, options}) {
	const resources = await workspace.byGlob(["/resources/**/*.*"]);

	return resourceListCreator({
		resources
	}, getCreatorOptions(options.projectName)).then((resourceLists) =>
		Promise.all(
			resourceLists.map((resourceList) => workspace.write(resourceList))
		)
	);
};
