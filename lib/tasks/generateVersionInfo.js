const versionInfoGenerator = require("../processors/versionInfoGenerator");

const DESCRIPTOR = "manifest.json";

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
 * @param {string} parameters.options.namespace Namespace of the project
 * @param {object} parameters.options.rootProject DuplexCollection to read and write files
 * @returns {Promise<undefined>} Promise resolving with <code>undefined</code> once data has been written
 */
module.exports = async ({workspace, dependencies, options: {rootProject, pattern, namespace}}) => {

	const resources = await dependencies.byGlob(pattern);
	const manifestResourcesPromises = resources.map((dotLibResource) => {
		const libraryNamespacePattern = /^\/resources\/(.*)\/\.library$/;
		const libraryIndicatorPath = dotLibResource.getPath();
		const libraryNamespaceMatch = libraryIndicatorPath.match(libraryNamespacePattern);
		if (libraryNamespaceMatch && libraryNamespaceMatch[1]) {
			const namespace = libraryNamespaceMatch[1];
			return workspace.byGlob(`/resources/${namespace}/**/${DESCRIPTOR}`);
		}
	});
	//TODO align libraryInfos and manifestInfos
	const manifestResources = await Promise.all(manifestResourcesPromises);
	const [versionInfoResource] = await versionInfoGenerator({
		options: {
			rootProjectName: rootProject.metadata.name,
			rootProjectVersion: rootProject.version,
			libraryInfos: resources.map((dotLibResource) => {
				return {
					name: dotLibResource._project.metadata.name,
					version: dotLibResource._project.version
				};
			}),
			manifestInfos: manifestResources
		}
	});
	return workspace.write(versionInfoResource);
};
