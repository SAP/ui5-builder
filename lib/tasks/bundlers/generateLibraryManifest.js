"use strict";

const log = require("@ui5/logger").getLogger("builder:tasks:bundlers:generateLibraryPreload");
const manifestCreator = require("../../processors/manifestCreator");
const ReaderCollectionPrioritized = require("@ui5/fs").ReaderCollectionPrioritized;


/**
 * Task for library bundling.
 *
 * @module builder/tasks/bundlers/generateLibraryPreload
 * @param {Object} parameters Parameters
 * @param {DuplexCollection} parameters.workspace DuplexCollection to read and write files
 * @param {AbstractReader} parameters.dependencies Reader or Collection to read dependency files
 * @param {Object} parameters.options Options
 * @param {string} parameters.options.projectName Project name
 * @returns {Promise<undefined>} Promise resolving with <code>undefined</code> once data has been written
 */
module.exports = function({workspace, dependencies, options}) {
	const combo = new ReaderCollectionPrioritized({
		name: `libraryBundler - prioritize workspace over dependencies: ${options.projectName}`,
		readers: [workspace, dependencies]
	});
	return combo.byGlob("/**/*.{js,json,xml,html,properties,library,less,css,theming,theme}").then((resources) => {
		// Find all libraries and create a library-preload.js bundle
		return workspace.byGlob("/resources/**/.library").then((libraryIndicatorResources) => {
			if (libraryIndicatorResources.length < 1) {
				// No library found - nothing to do
				log.error(`Could not find a ".library" or "library.js" file for project ${options.projectName}. Skipping library preload bundling.`);
				return;
			}

			return Promise.all(libraryIndicatorResources.map((libraryIndicatorResource) => {
				// Determine library namespace from library indicator file path
				// ending with either ".library" or "library.js" (see fallback logic above)
				// e.g. /resources/sap/foo/.library => sap/foo
				//      /resources/sap/bar/library.js => sap/bar
				const libraryNamespacePattern = /^\/resources\/(.*)\/\.library$/;
				const libraryIndicatorPath = libraryIndicatorResource.getPath();
				const libraryNamespaceMatch = libraryIndicatorPath.match(libraryNamespacePattern);
				if (libraryNamespaceMatch && libraryNamespaceMatch[1]) {
					const libraryNamespace = libraryNamespaceMatch[1];
					return manifestCreator({
						libraryResource: libraryIndicatorResource,
						namespace: libraryNamespace,
						resources,
						options: {
						}
					}).then((manifest) => {
						if (manifest) {
							return workspace.write(manifest);
						}
					});
				} else {
					log.verbose(`Could not determine library namespace from file "${libraryIndicatorPath}" for project ${options.projectName}. Skipping library preload bundling.`);
					return Promise.resolve();
				}
			}));
		});
	});
};
