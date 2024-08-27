import stringReplacer from "../processors/stringReplacer.js";

/**
 * @module @ui5/builder/tasks/replaceVersion
 */

/**
 * Task to replace the version <code>${version}</code>.
 *
 * @param parameters Parameters
 * @param parameters.workspace DuplexCollection to read and write files
 * @param parameters.options Options
 * @param parameters.options.pattern Pattern to locate the files to be processed
 * @param parameters.options.version Replacement version
 * @returns Promise resolving with <code>undefined</code> once data has been written
 */
export default function ({workspace, options: {pattern, version}}: object) {
	return workspace.byGlob(pattern)
		.then((allResources) => {
			return stringReplacer({
				resources: allResources,
				options: {
					pattern: /\$\{(?:project\.)?version\}/g,
					replacement: version,
				},
			});
		})
		.then((processedResources) => {
			return Promise.all(processedResources.map((resource) => {
				return workspace.write(resource);
			}));
		});
}
