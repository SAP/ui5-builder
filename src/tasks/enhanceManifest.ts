import manifestEnhancer from "../processors/manifestEnhancer.js";
import fsInterface from "@ui5/fs/fsInterface";

/* eslint "jsdoc/check-param-names": ["error", {"disableExtraPropertyReporting":true}] */
/**
 * Task for transforming the manifest.json file.
 * Adds missing information based on the available project resources,
 * for example the locales supported by the present i18n resources.
 *
 * @param parameters Parameters
 * @param parameters.workspace DuplexCollection to read and write files
 * @param parameters.options Options
 * @param parameters.options.projectNamespace Namespace of the application
 * @returns Promise resolving with <code>undefined</code> once data has been written
 */
export default async function ({workspace, options}: object) {
	const {projectNamespace} = options;

	// Note: all "manifest.json" files in the given namespace
	const resources = await workspace.byGlob(`/resources/${projectNamespace}/**/manifest.json`);

	const processedResources = await manifestEnhancer({
		resources,
		fs: fsInterface(workspace),
	});

	await Promise.all(processedResources.map((resource) => workspace.write(resource)));
}
