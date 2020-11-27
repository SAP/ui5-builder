const versionInfoGenerator = require("../processors/versionInfoGenerator");

const MANIFEST_JSON = "manifest.json";

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

	// app always builds all dependencies -> therefore glob all manifest.json
	// build with --all should not use the version-info.json
	// logic needs to be adjusted once selective dependencies are built
	// TODO: transient resources (not part of the build result) ( -> skipped for now)
	// exclude task if not build --all

	const libraryInfosPromises = resources.map((dotLibResource) => {
		const namespace = dotLibResource._project.metadata.namespace;
		// TODO favor manifest.json over .library (check first manifest.json then as fallback .library)
		// long-term goal: get rid of .library files
		// TODO: compare the two
		// use /**/ for nested manifests
		// use /sap.app/embeds
		return dependencies.byGlob(`/resources/${namespace}/**/${MANIFEST_JSON}`).then((manifestResources) => {
			const mainManifest = manifestResources.find((manifestResource) => {
				return manifestResource.getPath() === `/resources/${namespace}/${MANIFEST_JSON}`;
			});
			return {
				mainManifest,
				manifestResources,
				name: dotLibResource._project.metadata.name,
				version: dotLibResource._project.version
			};
		});
	});
	const libraryInfos = await Promise.all(libraryInfosPromises);

	const [versionInfoResource] = await versionInfoGenerator({
		options: {
			rootProjectName: rootProject.metadata.name,
			rootProjectVersion: rootProject.version,
			libraryInfos
		}
	});
	return workspace.write(versionInfoResource);
};
