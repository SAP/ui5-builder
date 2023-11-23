import { getLogger } from "@ui5/logger";
const log = getLogger("builder:tasks:transformManifest");
import manifestTransformer from "../processors/manifestTransformer.js";
import fsInterface from "@ui5/fs/fsInterface";

/**
 * Task for transforming the manifest.json file.
 *
 * @module builder/tasks/transformManifest
 *
 * @param {object} parameters Parameters
 * @param {@ui5/fs/DuplexCollection} parameters.workspace DuplexCollection to read and write files
 * @param {object} parameters.options Options
 * @param {string} parameters.options.projectNamespace Namespace of the project
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
				workspace.write(resource);
			}
		}));
}
