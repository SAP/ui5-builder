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
module.exports = async function({workspace, dependencies, options}) {
	const combo = new ReaderCollectionPrioritized({
		name: `theme - prioritize workspace over dependencies: ${options.projectName}`,
		readers: [workspace, dependencies]
	});

	const compress = options.compress === undefined ? true : options.compress;

	const pAllResources = workspace.byGlob(options.inputPattern);
	let pAvailableLibraries;
	let pAvailableThemes;
	if (options.librariesPattern) {
		// If a librariesPattern is given
		//	we will use it to reduce the set of libraries a theme will be built for
		pAvailableLibraries = combo.byGlob(options.librariesPattern);
	}
	if (options.themesPattern) {
		// If a themesPattern is given
		//	we will use it to reduce the set of themes that will be built
		pAvailableThemes = combo.byGlob(options.themesPattern);
	}

	/* Don't try to build themes for libraries that are not available
	(maybe replace this with something more aware of which dependencies are optional and therefore
		legitimately missing and which not (fault case))
		*/
	let availableLibraries;
	if (pAvailableLibraries) {
		availableLibraries = (await pAvailableLibraries).map((resource) => {
			return resource.getPath().replace(/[^/]*\.library/i, "");
		});
	}
	let availableThemes;
	if (pAvailableThemes) {
		availableThemes = (await pAvailableThemes).map((resource) => {
			return path.basename(resource.getPath());
		});
	}

	let allResources = await pAllResources;

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

	if (availableLibraries || availableThemes) {
		allResources = allResources.filter(isAvailable);
	}

	const processedResources = await themeBuilder({
		resources: allResources,
		fs: fsInterface(combo),
		options: {
			compress,
			cssVariables: !!options.cssVariables
		}
	});

	await Promise.all(processedResources.map((resource) => {
		return workspace.write(resource);
	}));
};
