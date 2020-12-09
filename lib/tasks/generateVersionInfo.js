const versionInfoGenerator = require("../processors/versionInfoGenerator");

/**
 * Task to create sap-ui-version.json
 *
 * @public
 * @alias module:@ui5/builder.tasks.generateVersionInfo
 * @param {object} parameters Parameters
 * @param {module:@ui5/fs.DuplexCollection} parameters.workspace DuplexCollection to read and write files
 * @param {module:@ui5/fs.AbstractReader} parameters.dependencies Reader or Collection to read dependency files
 * @param {object} parameters.options Options
 * @param {string} parameters.options.pattern Glob pattern for .library resources
 * @param {object} parameters.options.rootProject DuplexCollection to read and write files
 * @returns {Promise<undefined>} Promise resolving with <code>undefined</code> once data has been written
 */
module.exports = function({workspace, dependencies, options: {rootProject, pattern}}) {
	return dependencies.byGlob(pattern)
		.then((resources) => {
			return versionInfoGenerator({
				options: {
					rootProjectName: rootProject.metadata.name,
					rootProjectVersion: rootProject.version,
					libraryInfos: resources.map((dotLibResource) => {
						return {
							name: dotLibResource._project.metadata.name,
							version: dotLibResource._project.version
						};
					})
				}
			});
		})
		.then(([versionInfoResource]) => {
			return workspace.write(versionInfoResource);
		});
};
