const path = require("path");
const themeBuilder = require("../processors/themeBuilder");
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
 * @param {boolean} [parameters.options.compress=true]
 * @param {boolean} [parameters.options.cssVariables=false]
 * @returns {Promise<undefined>} Promise resolving with <code>undefined</code> once data has been written
 */
module.exports = function({workspace, dependencies, options}) {
	const combo = new ReaderCollectionPrioritized({
		name: `theme - prioritize workspace over dependencies: ${options.projectName}`,
		readers: [workspace, dependencies]
	});

	const promises = [workspace.byGlob(options.inputPattern)];
	if (options.librariesPattern) {
		// If a librariesPattern is given
		//	we will use it to reduce the set of libraries a theme will be built for
		promises.push(combo.byGlob(options.librariesPattern));
	} else {
		promises.push(Promise.resolve(null));
	}
	if (options.themesPattern) {
		// If a themesPattern is given
		//	we will use it to reduce the set of themes that will be built
		promises.push(combo.byGlob(options.themesPattern));
	} else {
		promises.push(Promise.resolve(null));
	}

	const compress = options.compress === undefined ? true : options.compress;

	return Promise.all(promises).then(([allResources, availableLibraries, availableThemes]) => {
		/* Don't try to build themes for libraries that are not available
			(maybe replace this with something more aware of which dependencies are optional and therefore
			legitimately missing and which not (fault case))
		*/
		if (availableLibraries) {
			availableLibraries = availableLibraries.map((resource) => {
				return resource.getPath().replace(/[^/]*\.library/i, "");
			});
		}
		if (availableThemes) {
			availableThemes = availableThemes.map((resource) => {
				return path.basename(resource.getPath());
			});
		}

		const isAvailable = function(resource) {
			const resourcePath = resource.getPath();
			const themeName = path.basename(path.dirname(resourcePath));

			const themeAvailable = !availableThemes || availableThemes.includes(themeName);
			if (!themeAvailable) {
				return false;
			}

			if (!availableLibraries) {
				return true;
			}

			for (let i = availableLibraries.length - 1; i >= 0; i--) {
				if (resourcePath.startsWith(availableLibraries[i])) {
					return true;
				}
			}
			return false;
		};

		if (!availableLibraries && !availableThemes) {
			return allResources;
		} else {
			return allResources.filter(isAvailable);
		}
	}).then((resources) => {
		return themeBuilder({
			resources,
			fs: fsInterface(combo),
			options: {
				compress,
				cssVariables: !!options.cssVariables
			}
		});
	}).then((processedResources) => {
		return Promise.all(processedResources.map((resource) => {
			return workspace.write(resource);
		}));
	});
};
