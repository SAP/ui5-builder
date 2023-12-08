import manifestTransformer from "../processors/manifestTransformer.js";
import fsInterface from "@ui5/fs/fsInterface";
import {getLogger} from "@ui5/logger";
const log = getLogger("builder:task:transformerManifest");

/* eslint "jsdoc/check-param-names": ["error", {"disableExtraPropertyReporting":true}] */
/**
 * Task for transforming the manifest.json file.
 *
 * @public
 * @function default
 * @static
 *
 * @param {object} parameters Parameters
 * @param {@ui5/fs/DuplexCollection} parameters.workspace DuplexCollection to read and write files
 * @param {object} parameters.options Options
 * @param {string} parameters.options.projectNamespace Namespace of the application
 * @returns {Promise<undefined>} Promise resolving with <code>undefined</code> once data has been written
 */
export default async function({workspace, options}) {
	// Backward compatibility: "namespace" option got renamed to "projectNamespace"
	const namespace = options.projectNamespace || options.namespace;

	// Note: all "manifest.json" files
	return workspace.byGlob(`/resources/${namespace}/**/manifest.json`)
		.then((resources) => {
			return manifestTransformer({
				resources,
				fs: fsInterface(workspace),
				options
			});
		})
		.then((resources) => resources.map((resource) => {
			if (resource) {
				log.verbose("Resource transformed: " + resource.getPath());
				workspace.write(resource);
			} else {
				log.verbose("No resource changed");
			}
		}));
}
