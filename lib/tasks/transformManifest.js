import {getLogger} from "@ui5/logger";
const log = getLogger("builder:tasks:transformManifest");
import manifestTransformer from "../processors/manifestTransformer.js";

/**
 * Task for transforming the manifest.json file.
 *
 * @module builder/tasks/transformManifest
 *
 * @param {object} parameters Parameters
 * @param {@ui5/fs/DuplexCollection} parameters.workspace DuplexCollection to read and write files
 * @param {object} parameters.options Options
 * @param {string} parameters.options.projectName Project name
 * @param {string} [parameters.options.namespace] Project namespace
 * @returns {Promise<undefined>} Promise resolving with <code>undefined</code> once data has been written
 */
export default async function({workspace, options}) {
	const {projectName} = options;
	// Backward compatibility: "namespace" option got renamed to "projectNamespace"
	const namespace = options.projectNamespace || options.namespace;

	let manifestPath;
	if (namespace) {
		manifestPath = `/resources/${namespace}/manifest.json`;
	} else {
		manifestPath = "/manifest.json";
	}
	const resource = await workspace.byPath(manifestPath);
	if (!resource) {
		log.error(`No manifest.json detected in project "${projectName}".`);
		return;
	}
	const processedResources = await manifestTransformer({
		resources: [resource],
		options: {
			noop: "Noop"
		}
	});
	await Promise.all(processedResources.map((resource) => workspace.write(resource)));
}
