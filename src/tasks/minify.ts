import minifier from "../processors/minifier.js";
import fsInterface from "@ui5/fs/fsInterface";

/**
 * @module @ui5/builder/tasks/minify
 */

/**
 * Task to minify resources.
 *
 * @param parameters Parameters
 * @param parameters.workspace DuplexCollection to read and write files
 * @param [parameters.taskUtil] TaskUtil
 * @param parameters.options Options
 * @param parameters.options.pattern Pattern to locate the files to be processed
 * @param [parameters.options.omitSourceMapResources] Whether source map resources shall
 * 		be tagged as "OmitFromBuildResult" and no sourceMappingURL shall be added to the minified resource
 * @param [parameters.options.useInputSourceMaps] Whether to make use of any existing source
 * 		maps referenced in the resources to be minified. Use this option to preserve reference to the original
 * 		source files, such as TypeScript files, in the generated source map.
 * @returns Promise resolving with <code>undefined</code> once data has been written
 */
export default async function ({workspace, taskUtil, options: {pattern, omitSourceMapResources = false, useInputSourceMaps = true}}: object) {
	const resources = await workspace.byGlob(pattern);
	const processedResources = await minifier({
		resources,
		fs: fsInterface(workspace),
		taskUtil,
		options: {
			addSourceMappingUrl: !omitSourceMapResources,
			readSourceMappingUrl: !!useInputSourceMaps,
			useWorkers: !!taskUtil,
		},
	});

	return Promise.all(processedResources.map(async ({
		resource, dbgResource, sourceMapResource, dbgSourceMapResource,
	}) => {
		if (taskUtil) {
			taskUtil.setTag(resource, taskUtil.STANDARD_TAGS.HasDebugVariant);
			taskUtil.setTag(dbgResource, taskUtil.STANDARD_TAGS.IsDebugVariant);
			taskUtil.setTag(sourceMapResource, taskUtil.STANDARD_TAGS.HasDebugVariant);
			if (omitSourceMapResources) {
				taskUtil.setTag(sourceMapResource, taskUtil.STANDARD_TAGS.OmitFromBuildResult);
			}
			if (dbgSourceMapResource) {
				taskUtil.setTag(dbgSourceMapResource, taskUtil.STANDARD_TAGS.IsDebugVariant);
				if (omitSourceMapResources) {
					taskUtil.setTag(dbgSourceMapResource, taskUtil.STANDARD_TAGS.OmitFromBuildResult);
				}
			}
		}
		return Promise.all([
			workspace.write(resource),
			workspace.write(dbgResource),
			workspace.write(sourceMapResource),
			dbgSourceMapResource && workspace.write(dbgSourceMapResource),
		]);
	}));
}
