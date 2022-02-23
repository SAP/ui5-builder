const moduleBundler = require("../../processors/bundlers/moduleBundler");
const ModuleName = require("../../lbt/utils/ModuleName");
const ReaderCollectionPrioritized = require("@ui5/fs").ReaderCollectionPrioritized;

/**
 * Generates a bundle based on the given bundle definition
 *
 * @public
 * @alias module:@ui5/builder.tasks.generateBundle
 * @param {object} parameters Parameters
 * @param {module:@ui5/fs.DuplexCollection} parameters.workspace DuplexCollection to read and write files
 * @param {module:@ui5/fs.ReaderCollection} parameters.dependencies Collection to read dependency files
 * @param {module:@ui5/builder.tasks.TaskUtil|object} [parameters.taskUtil] TaskUtil
 * @param {object} parameters.options Options
 * @param {string} parameters.options.projectName Project name
 * @param {ModuleBundleDefinition} parameters.options.bundleDefinition Module bundle definition
 * @param {ModuleBundleOptions} [parameters.options.bundleOptions] Module bundle options
 * @returns {Promise} Promise resolving with <code>undefined</code> once data has been written
 */
module.exports = function({
	workspace, dependencies, taskUtil, options: {projectName, bundleDefinition, bundleOptions}
}) {
	let combo = new ReaderCollectionPrioritized({
		name: `libraryBundler - prioritize workspace over dependencies: ${projectName}`,
		readers: [workspace, dependencies]
	});

	const optimize = !bundleOptions || bundleOptions.optimize !== false;
	if (taskUtil) {
		/* Scenarios
			1. Optimize bundle with minification already done
				Workspace:
					* my/lib/Control.js 				[ui5:HasDebugVariant]
					* my/lib/Control.js.map 			[ui5:HasDebugVariant]
					* my/lib/Control-dbg.js 			[ui5:IsDebugVariant]

				Bundler input:
					* my/lib/Control.js
					* my/lib/Control.js.map

				=> Filter out debug resources

			2. Optimize bundle with no minification
				* my/lib/Control.js

				=> No action necessary

			3. Debug-bundle with minification already done
				Workspace:
					* my/lib/Control.js 				[ui5:HasDebugVariant]
					* my/lib/Control.js.map 			[ui5:HasDebugVariant]
					* my/lib/Control-dbg.js 			[ui5:IsDebugVariant]

				Bundler input:
					* my/lib/Control.js => Renamed from "Control-dbg.js"

				=> Filter out minified-resources (tagged as "HasDebugVariant", incl. source maps) and rename debug-files

			4. Debug-bundle with no minification
				* my/lib/Control.js

				=> No action necessary

			5. Bundle with external input (optimize or not), e.g. TS-project
				Workspace:
					* my/lib/Control.ts
					* my/lib/Control.js
					* my/lib/Control.js.map

				Bundler input:
					* my/lib/Control.js
					* my/lib/Control.js.map
		*/

		// Omit -dbg files for optimize bundles and vice versa
		const filterTag = optimize ?
			taskUtil.STANDARD_TAGS.IsDebugVariant : taskUtil.STANDARD_TAGS.HasDebugVariant;
		combo = combo.filter(function(resource) {
			return !taskUtil.getTag(resource, filterTag);
		});
	}

	return combo.byGlob("/resources/**/*.{js,json,xml,html,properties,library,js.map}").then((resources) => {
		const moduleNameMapping = {};
		if (!optimize && taskUtil) {
			// For "unoptimized" bundles, the non-debug files have already been filtered out
			// Now rename the debug variants to the same name so that they appear like the original
			// resource to the bundler
			for (let i = resources.length - 1; i >= 0; i--) {
				const resourcePath = resources[i].getPath();
				if (taskUtil.getTag(resourcePath, taskUtil.STANDARD_TAGS.IsDebugVariant)) {
					const nonDbgPath = ModuleName.getNonDebugName(resourcePath);
					if (!nonDbgPath) {
						throw new Error(`Failed to resolve non-debug name for ${resourcePath}`);
					}
					moduleNameMapping[resourcePath] = nonDbgPath.slice("/resources/".length);
				}
			}
		}
		return moduleBundler({
			options: {
				bundleDefinition,
				bundleOptions,
				moduleNameMapping
			},
			resources
		}).then((bundles) => {
			return Promise.all(bundles.map(({bundle, sourceMap}) => {
				if (taskUtil) {
					taskUtil.setTag(bundle, taskUtil.STANDARD_TAGS.IsBundle);
					if (sourceMap) {
						// Clear tag that might have been set by the minify task, in cases where
						// the bundle name is identical to a source file
						taskUtil.clearTag(sourceMap, taskUtil.STANDARD_TAGS.OmitFromBuildResult);
					}
				}
				const writes = [workspace.write(bundle)];
				if (sourceMap) {
					writes.push(workspace.write(sourceMap));
				}
				return Promise.all(writes);
			}));
		});
	});
};
