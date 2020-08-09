const log = require("@ui5/logger").getLogger("builder:tasks:bundlers:generateLibraryPreload");
const moduleBundler = require("../../processors/bundlers/moduleBundler");
const ReaderCollectionPrioritized = require("@ui5/fs").ReaderCollectionPrioritized;

function getDefaultLibraryPreloadFilters(namespace) {
	return [
		`${namespace}/`,
		`!${namespace}/.library`,
		`!${namespace}/designtime/`,
		`!${namespace}/**/*.designtime.js`,
		`!${namespace}/**/*.support.js`,
		`!${namespace}/themes/`,
		`!${namespace}/messagebundle*`
	];
}

function getBundleDefinition(namespace) {
	// TODO: move to config of actual core project
	if (namespace === "sap/ui/core") {
		return {
			name: `${namespace}/library-preload.js`,
			defaultFileTypes: [".js", ".fragment.xml", ".view.xml", ".properties", ".json"],
			sections: [
				{
					// exclude the content of sap-ui-core by declaring it as 'provided'
					mode: "provided",
					filters: [
						"ui5loader-autoconfig.js",
						"sap/ui/core/Core.js"
					],
					resolve: true
				},
				{
					mode: "preload",
					filters: [
						...getDefaultLibraryPreloadFilters(namespace),

						`!${namespace}/cldr/`,
						"*.js",
						"sap/base/",
						"sap/ui/base/",
						"sap/ui/dom/",
						"sap/ui/events/",
						"sap/ui/model/",
						"sap/ui/security/",
						"sap/ui/util/",
						"sap/ui/Global.js",

						// include only thirdparty that is very likely to be used
						"sap/ui/thirdparty/crossroads.js",
						"sap/ui/thirdparty/caja-htmlsanitizer.js",
						"sap/ui/thirdparty/hasher.js",
						"sap/ui/thirdparty/signals.js",
						"sap/ui/thirdparty/jquery-mobile-custom.js",
						"sap/ui/thirdparty/jqueryui/jquery-ui-core.js",
						"sap/ui/thirdparty/jqueryui/jquery-ui-position.js",

						// other excludes (not required for productive scenarios)
						"!sap-ui-*.js",
						"!sap/ui/core/support/",
						"!sap/ui/core/plugin/DeclarativeSupport.js",
						"!sap/ui/core/plugin/LessSupport.js"

					],
					resolve: false,
					resolveConditional: false,
					renderer: true
				}
			]
		};
	}
	return {
		name: `${namespace}/library-preload.js`,
		defaultFileTypes: [".js", ".fragment.xml", ".view.xml", ".properties", ".json"],
		sections: [
			{
				mode: "preload",
				filters: getDefaultLibraryPreloadFilters(namespace),
				resolve: false,
				resolveConditional: false,
				renderer: true
			}
		]
	};
}

function getModuleBundlerOptions(config) {
	const moduleBundlerOptions = {};

	// required in sap-ui-core-nojQuery.js and sap-ui-core-nojQuery-dbg.js
	const providedSection = {
		mode: "provided",
		filters: [
			"jquery-ui-core.js",
			"jquery-ui-datepicker.js",
			"jquery-ui-position.js",
			"sap/ui/thirdparty/jquery.js",
			"sap/ui/thirdparty/jquery/*",
			"sap/ui/thirdparty/jqueryui/*"
		]
	};

	moduleBundlerOptions.bundleOptions = {
		optimize: config.preload,
		decorateBootstrapModule: config.preload,
		addTryCatchRestartWrapper: config.preload,
		usePredefineCalls: config.preload
	};

	moduleBundlerOptions.bundleDefinition = getSapUiCoreBunDef(config.name, config.filters, config.preload);

	if (config.provided) {
		moduleBundlerOptions.bundleDefinition.sections.unshift(providedSection);
	}

	return moduleBundlerOptions;
}

function getSapUiCoreBunDef(name, filters, preload) {
	const bundleDefinition = {
		name,
		sections: []
	};

	// add raw section
	bundleDefinition.sections.push({
		// include all 'raw' modules that are needed for the UI5 loader
		mode: "raw",
		filters,
		resolve: true, // dependencies for raw modules are taken from shims in .library files
		sort: true, // topological sort on raw modules is mandatory
		declareModules: false
	});

	if (preload) {
		// add preload section
		bundleDefinition.sections.push({
			mode: "preload",
			filters: [
				"sap/ui/core/Core.js"
			],
			resolve: true
		});
	}

	// add require section
	bundleDefinition.sections.push({
		mode: "require",
		filters: [
			"sap/ui/core/Core.js"
		]
	});

	return bundleDefinition;
}

/**
 * Task for library bundling.
 *
 * @public
 * @alias module:@ui5/builder.tasks.generateLibraryPreload
 * @param {object} parameters Parameters
 * @param {module:@ui5/fs.DuplexCollection} parameters.workspace DuplexCollection to read and write files
 * @param {module:@ui5/fs.AbstractReader} parameters.dependencies Reader or Collection to read dependency files
 * @param {object} parameters.options Options
 * @param {string} parameters.options.projectName Project name
 * @returns {Promise<undefined>} Promise resolving with <code>undefined</code> once data has been written
 */
module.exports = function({workspace, dependencies, options: {projectName}}) {
	const combo = new ReaderCollectionPrioritized({
		name: `libraryBundler - prioritize workspace over dependencies: ${projectName}`,
		readers: [workspace, dependencies]
	});

	return combo.byGlob("/**/*.{js,json,xml,html,properties,library}").then((resources) => {
		// Find all libraries and create a library-preload.js bundle

		let p;

		// Create sap-ui-core.js
		// TODO: move to config of actual core project
		if (projectName === "sap.ui.core") {
			// Filter out sap-ui-core.js from further uglification/replacement processors
			//	to prevent them from overwriting it
			resources = resources.filter((resource) => {
				return resource.getPath() !== "/resources/sap-ui-core.js";
			});

			const isEvo = resources.find((resource) => {
				return resource.getPath() === "/resources/ui5loader.js";
			});
			let filters;
			if (isEvo) {
				filters = ["ui5loader-autoconfig.js"];
			} else {
				filters = ["jquery.sap.global.js"];
			}

			p = Promise.all([
				moduleBundler({
					options: getModuleBundlerOptions({name: "sap-ui-core.js", filters, preload: true}),
					resources
				}),
				moduleBundler({
					options: getModuleBundlerOptions({name: "sap-ui-core-dbg.js", filters, preload: false}),
					resources
				}),
				moduleBundler({
					options: getModuleBundlerOptions({name: "sap-ui-core-nojQuery.js", filters, preload: true, provided: true}),
					resources
				}),
				moduleBundler({
					options: getModuleBundlerOptions({name: "sap-ui-core-nojQuery-dbg.js", filters, preload: false, provided: true}),
					resources
				}),
			]).then((results) => {
				const bundles = Array.prototype.concat.apply([], results);
				return Promise.all(bundles.map((bundle) => workspace.write(bundle)));
			});
		} else {
			p = Promise.resolve();
		}

		return p.then(() => {
			return workspace.byGlob("/resources/**/.library").then((libraryIndicatorResources) => {
				if (libraryIndicatorResources.length > 0) {
					return libraryIndicatorResources;
				} else {
					// Fallback to "library.js" as library indicator
					log.verbose(`Could not find a ".library" file for project ${projectName}, falling back to "library.js".`);
					return workspace.byGlob("/resources/**/library.js");
				}
			}).then((libraryIndicatorResources) => {
				if (libraryIndicatorResources.length < 1) {
					// No library found - nothing to do
					log.verbose(`Could not find a ".library" or "library.js" file for project ${projectName}. Skipping library preload bundling.`);
					return;
				}

				return Promise.all(libraryIndicatorResources.map((libraryIndicatorResource) => {
					// Determine library namespace from library indicator file path
					// ending with either ".library" or "library.js" (see fallback logic above)
					// e.g. /resources/sap/foo/.library => sap/foo
					//      /resources/sap/bar/library.js => sap/bar
					const libraryNamespacePattern = /^\/resources\/(.*)\/(?:\.library|library\.js)$/;
					const libraryIndicatorPath = libraryIndicatorResource.getPath();
					const libraryNamespaceMatch = libraryIndicatorPath.match(libraryNamespacePattern);
					if (libraryNamespaceMatch && libraryNamespaceMatch[1]) {
						const libraryNamespace = libraryNamespaceMatch[1];
						return moduleBundler({
							options: {
								bundleDefinition: getBundleDefinition(libraryNamespace),
								bundleOptions: {
									optimize: true,
									usePredefineCalls: true,
									ignoreMissingModules: true
								}
							},
							resources
						}).then(([bundle]) => {
							if (bundle) {
								// console.log(`${libraryNamespace}/library-preload.js bundle created`);
								return workspace.write(bundle);
							}
						});
					} else {
						log.verbose(`Could not determine library namespace from file "${libraryIndicatorPath}" for project ${projectName}. Skipping library preload bundling.`);
						return Promise.resolve();
					}
				}));
			});
		});
	});
};
