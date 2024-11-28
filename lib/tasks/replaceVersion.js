import stringReplacer from "../processors/stringReplacer.js";

/**
 * @public
 * @module @ui5/builder/tasks/replaceVersion
 */

/**
 * Task to replace the version <code>${version}</code>.
 *
 * @public
 * @function default
 * @static
 *
 * @param {object} parameters Parameters
 * @param {@ui5/fs/DuplexCollection} parameters.workspace DuplexCollection to read and write files
 * @param {object} parameters.options Options
 * @param {string} parameters.options.pattern Pattern to locate the files to be processed
 * @param {string} parameters.options.version Replacement version
 * @returns {Promise<undefined>} Promise resolving with <code>undefined</code> once data has been written
 */
export default async function({workspace, invalidatedResources, options: {pattern, version}}) {
	let allResources;
	if (invalidatedResources) {
		allResources = await Promise.all(invalidatedResources.map((resource) => workspace.byPath(resource)));
	} else {
		allResources = await workspace.byGlob(pattern);
	}
	const processedResources = await stringReplacer({
		resources: allResources,
		options: {
			pattern: /\$\{(?:project\.)?version\}/g,
			replacement: version
		}
	});
	await Promise.all(processedResources.map((resource) => {
		if (resource) {
			return workspace.write(resource, undefined, resource);
		}
	}));
}
