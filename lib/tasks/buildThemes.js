const themeBuilder = require("../processors/themeBuilder");
const cssOptimizer = require("../processors/cssOptimizer");
const ReaderCollectionPrioritized = require("@ui5/fs").ReaderCollectionPrioritized;
const fsInterface = require("@ui5/fs").fsInterface;

/**
 * Task to build a library theme.
 *
 * @public
 * @alias module:@ui5/builder.tasks.buildThemes
 * @param {Object} parameters Parameters
 * @param {module:@ui5/fs.DuplexCollection} parameters.workspace DuplexCollection to read and write files
 * @param {module:@ui5/fs.AbstractReader} parameters.dependencies Reader or Collection to read dependency files
 * @param {Object} parameters.options Options
 * @param {string} parameters.options.projectName Project name
 * @param {string} parameters.options.inputPattern Search pattern for *.less files to be built
 * @param {string} [parameters.options.librariesPattern] Search pattern for .library files
 * @param {boolean} [parameters.options.compress=true] Whether or not to compress the theme resources
 * @returns {Promise<undefined>} Promise resolving with <code>undefined</code> once data has been written
 */
module.exports = async function({workspace, dependencies, options}) {
	const combo = new ReaderCollectionPrioritized({
		name: `theme - prioritize workspace over dependencies: ${options.projectName}`,
		readers: [workspace, dependencies]
	});

	const promises = [workspace.byGlob(options.inputPattern)];
	if (options.librariesPattern) {
		// If a librariesPattern is given
		//	we will use it to reduce the set of libraries a theme will be built for
		promises.push(combo.byGlob(options.librariesPattern));
	}

	const [allResources, availableLibraries] = await Promise.all(promises);

	let resources;
	if (!availableLibraries || availableLibraries.length === 0) {
		// Try to build all themes
		resources = allResources;
	} else {
		/* Don't try to build themes for libraries that are not available
			(maybe replace this with something more aware of which dependencies are optional and therefore
			legitimately missing and which not (fault case))
		*/
		const availableLibraryPaths = availableLibraries.map((resource) => {
			return resource.getPath().replace(/[^/]*\.library/i, "");
		});

		const isAvailable = function(resource) {
			for (let i = availableLibraryPaths.length - 1; i >= 0; i--) {
				if (resource.getPath().indexOf(availableLibraryPaths[i]) === 0) {
					return true;
				}
			}
			return false;
		};

		resources = await allResources.filter(isAvailable);
	}

	const compress = options.compress === undefined ? true : options.compress;
	// do not use compression flag of less.js css (deprecated)
	const processedResources = await themeBuilder({
		resources,
		fs: fsInterface(combo),
		options: {
			compressJSON: compress,
			compress: false
		}
	});

	if (compress) {
		const cssResources = processedResources.filter((resource) => {
			return resource.getPath().endsWith(".css");
		});
		await cssOptimizer({resources: cssResources,
			fs: fsInterface(combo)});
	}
	return Promise.all(processedResources.map((resource) => {
		return workspace.write(resource);
	}));
};
