import {getLogger} from "@ui5/logger";
const log = getLogger("builder:processors:manifestTransformer");


async function transformManifest(resources) {
	return resources;
}

/**
 * @module @ui5/builder/processors/manifestTransformer
 */

/**
 * Transforms the content of the manifest.json file.
 *
 * @public
 * @function default
 * @static
 *
 * @param {object} parameters Parameters
 * @param {@ui5/fs/Resource[]} parameters.resources List of resources to be processed
 * @param {object} parameters.options Options
 * @param {string} parameters.options.noop Its just a config
 * @returns {Promise<@ui5/fs/Resource[]>} Promise resolving with the cloned resources
 */
export default function({resources, options: {noop}}) {
	log.verbose("Lets start transforming");
	return transformManifest(resources);
}
