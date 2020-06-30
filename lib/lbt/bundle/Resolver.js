/**
 * Takes a bundle definition and resolves it against the given pool.
 */
"use strict";

const topologicalSort = require("../graph/topologicalSort");
const UI5ClientConstants = require("../UI5ClientConstants");
const ResourceFilterList = require("../resources/ResourceFilterList");

const {SectionType} = require("./BundleDefinition");
const ResolvedBundleDefinition = require("./ResolvedBundleDefinition");
const log = require("@ui5/logger").getLogger("lbt:bundle:Resolver");

let dependencyTracker;

/**
 * Resolve a bundle definition.
 *
 * - evaluate include / exclude filters for each section
 * - follow dependencies, if option 'resolve' is configured for a section
 *
 * TODO ModuleResolver changes the order of the configured modules even if resolve isn't true
 *
 * @private
 */
class BundleResolver {
	// private final Trace trace;
	constructor(pool) {
		this.pool = pool;
	}
	// NODE-TODO private final Map<ModuleName, AbstractModuleDefinition> moduleDefinitions;

	/**
	 * @param {ModuleDefinition} bundle Bundle definition to resolve
	 * @param {object} [options] Options
	 * @param {string[]} [options.defaultFileTypes] List of default file types to which a prefix pattern shall be expanded.
	 * @returns {Promise<ResolvedBundleDefinition>}
	 */
	resolve(bundle, options) {
		const fileTypes = (options && options.defaultFileTypes) || undefined;
		let visitedResources = Object.create(null);
		let selectedResources = Object.create(null);
		let selectedResourcesSequence = [];
		const pool = this.pool;

		/**
		 * @param {JSModuleSectionDefinition} section
		 * @returns {Collection<ModuleName>}
		 */
		function collectModulesForSection(section) {
			let prevLength;
			let newKeys;

			const filters = new ResourceFilterList( section.filters, fileTypes ); // resolvePlaceholders(section.getFilters());

			function isAccepted(resourceName, required) {
				let match = required;
				// evaluate module filters only when global filters match
				match = filters.matches(resourceName, required); // NODE-TODO filter.matches(name, match, required);
				return match;
			}

			function checkForDecomposableBundle(resource) {
				if ( resource == null ||
						resource.info == null ||
						resource.info.subModules.length === 0 ||
						/(?:^|\/)library.js$/.test(resource.info.name) ) {
					return {resource, decomposable: false};
				}

				return Promise.all(
					resource.info.subModules.map((sub) => pool.findResource(sub).catch(() => false))
				).then((modules) => {
					// it might look more natural to expect 'all' embedded modules to exist in the pool,
					// but expecting only 'some' module to exist is a more conservative approach
					return ({resource, decomposable: modules.some(($) => ($))});
				});
			}

			function checkAndAddResource(resourceName, depth, msg) {
				// console.log("    checking " + resourceName + " at depth " + depth);
				let maybeAccepted = true;
				let done;

				if ( !(resourceName in visitedResources) && (maybeAccepted = isAccepted(resourceName, depth > 0)) ) {
					// console.log("    accepted: " + resourceName );
					if ( dependencyTracker != null ) {
						dependencyTracker.visitDependency(resourceName);
					}

					// remember that we have seen this module already
					visitedResources[resourceName] = resourceName;

					done = pool.findResourceWithInfo(resourceName)
						.catch( (err) => {
							// if the caller provided an error message, log it
							if ( msg ) {
								log.error(msg);
							}
							// return undefined
						})
						.then( (resource) => checkForDecomposableBundle(resource) )
						.then( ({resource, decomposable}) => {
							const dependencyInfo = resource && resource.info;
							let promises = [];

							if ( decomposable ) {
								// bundles are not added, only their embedded modules
								promises = dependencyInfo.subModules.map( (included) => {
									return checkAndAddResource(included, depth + 1,
										"**** error: missing submodule " + included + ", included by " + resourceName);
								});
							} else if ( resource != null ) {
								// trace.trace("    checking dependencies of " + resource.name );
								selectedResources[resourceName] = resourceName;
								selectedResourcesSequence.push(resourceName);

								// trace.info("    collecting %s", resource.name);

								// add dependencies, if 'resolve' is configured
								if ( section.resolve && dependencyInfo ) {
									promises = dependencyInfo.dependencies.map( function(required) {
										// ignore conditional dependencies if not configured
										if ( !section.resolveConditional &&
												dependencyInfo.isConditionalDependency(required) ) {
											return;
										}

										return checkAndAddResource( required, depth + 1,
											"**** error: missing module " + required + ", required by " + resourceName);
									});
								}

								// add renderer, if 'renderer' is configured and if it exists
								if ( section.renderer ) {
									const rendererModuleName = UI5ClientConstants.getRendererName( resourceName );
									promises.push( checkAndAddResource( rendererModuleName, depth + 1) );
								}
							}

							return Promise.all( promises.filter( ($) => $ ) );
						});

					if ( dependencyTracker != null ) {
						dependencyTracker.endVisitDependency(resourceName);
					}
				} else if ( dependencyTracker != null && maybeAccepted && isAccepted(resourceName, depth>0) ) {
					// Note: the additional 'maybeAccepted' condition avoids calling the expensive 'isAccepted'
					// twice if it already returned false in the 'if' condition

					dependencyTracker.visitDependencyAgain(resourceName);

					done = Promise.resolve(true);
				}

				return done;
			}

			let oldSelectedResources;
			let oldIgnoredResources;
			let oldSelectedResourcesSequence;

			if ( section.mode == SectionType.Require ) {
				oldSelectedResources = selectedResources;
				oldIgnoredResources = visitedResources;
				oldSelectedResourcesSequence = selectedResourcesSequence;
				selectedResources = Object.create(null);
				selectedResourcesSequence = [];
				visitedResources = Object.create(null);
			} else {
				// remember current state of module collection - needed to determine difference set later
				prevLength = selectedResourcesSequence.length;
			}

			/*
			 * In the Maven version of the bundle tooling, it was possible to define the content
			 * of a section of type 'provided' by listing a set of other bundle definition files.
			 * The whole content of those bundles then was determined and excluded from the current bundle.
			 *
			 * In the NodeJS version of the tooling, this is not supported. Instead, the resulting JS file for
			 * a bundle can be specified and the dependency analysis will determine the content of the bundle
			 * and exclude it from the current bundle.
			 *
			if ( section.mode == SectionType.Provided && section.modules ) {
				throw new Error("unsupported");
				for(ModuleName providedModuleDefinitionName : section.getProvidedModules()) {
					AbstractModuleDefinition providedModuleDefinition =
						moduleDefinitions.get(providedModuleDefinitionName);
					if ( providedModuleDefinition instanceof JSModuleDefinition ) {
						trace.verbose("    resolving provided module %s", providedModuleDefinitionName);
						ModuleResolver resolver = new ModuleResolver(trace, pool, moduleDefinitions, null);
						ResolvedBundleDefinition resolved = resolver.run((JSModuleDefinition) providedModuleDefinition,
							placeholderValues);
						for(ResolvedBundleDefinitionSection resolvedSection : resolved.getSections()) {
							if ( resolvedSection.getMode() != SectionType.Require ) {
								for(ModuleName providedModuleName : resolvedSection.getModules()) {
									ModuleInfo providedModuleInfo = pool.getModuleInfo(providedModuleName);
									if ( providedModuleInfo != null &&
											!visitedModules.containsKey(providedModuleName) ) {
										visitedModules.put(providedModuleName, providedModuleInfo);
									}
								}
							}
						}
					} else {
						trace.error("provided module could not be found or is not a JS module : %s",
							providedModuleDefinitionName);
					}
				}
			}
			*/

			// scan all known resources
			const promises = pool.resources.map( function(resource) {
				return checkAndAddResource(resource.name, 0);
			});

			return Promise.all(promises).then( function() {
				if ( section.mode == SectionType.Require ) {
					newKeys = selectedResourcesSequence;
					selectedResources = oldSelectedResources;
					visitedResources = oldIgnoredResources;
					selectedResourcesSequence = oldSelectedResourcesSequence;
				} else {
					newKeys = selectedResourcesSequence.slice( prevLength ); // preserve order (for raw sections)
				}

				// console.log("    resolved module set: %s", newKeys);
				return newKeys;
			});
		}

		/*
		 * In the Maven version of the bundle tooling, a bundle definition could be
		 * parameterized by locale, ltr/rtl mode and theme. The LBT doesn't support this yet.
		 *
		 * As theming files are build with less now, only the parameterization by locale
		 * might be needed. It's lack can be compensated by programmatically building the
		 * necessary bundle definitions and e.g. injecting the locale into the Id or the
		 * filters defining the content of the bundle.
		 * .
		private Collection<ModuleFilter> resolvePlaceholders(Collection<ModuleFilter> list) {
			if ( !placeholderValues.isEmpty() ) {
				List<ModuleFilter> modifiedList = new ArrayList<ModuleFilter>(list);
				for(int i=0; i<modifiedList.size(); i++) {
					ModuleNameMatcher matcher = modifiedList.get(i).getMatcher();
					ModuleNameMatcher resolved = ModuleNamePattern.resolvePlaceholders(matcher, placeholderValues);
					if ( resolved != matcher ) {
						modifiedList.set(i, new ModuleFilter(resolved, modifiedList.get(i).getMode()));
					}
				}
				list = modifiedList;
			}
			return list;
		} */

		// NODE-TODO if ( PerfMeasurement.ACTIVE ) PerfMeasurement.start(PerfKeys.RESOLVE_MODULE);

		if ( dependencyTracker != null ) {
			dependencyTracker.startResolution(bundle);
		}

		// NODE-TODO placeholderValues = vars;

		log.verbose("  resolving bundle definition %s", bundle.name);

		const resolved = new ResolvedBundleDefinition(bundle /* , vars*/);

		let previous = Promise.resolve(true);

		bundle.sections.forEach(function(section, index) {
			previous = previous.then( function() {
				log.verbose("    resolving section%s of type %s",
					section.name ? " '" + section.name + "'" : "", section.mode);

				// NODE-TODO long t0=System.nanoTime();
				const resolvedSection = resolved.sections[index];

				return collectModulesForSection(section).
					then( (modules) => {
						if ( section.mode == SectionType.Raw && section.sort ) {
							// sort the modules in topological order
							return topologicalSort(pool, modules).then( (modules) => {
								log.verbose("      resolved modules (sorted): %s", modules);
								return modules;
							});
						}

						log.verbose("      resolved modules: %s", modules);
						return modules;
					}).then( function(modules) {
						resolvedSection.modules = modules;
					});
				// NODE-TODO long t1=System.nanoTime();

				// NODE-TODO if ( PerfMeasurement.ACTIVE ) trace.info("[Measurement] %12d nsec - %s", t1-t0,
				// 												"Module collection and filtering");
			});
		});

		if ( dependencyTracker != null ) {
			dependencyTracker.endResolution(bundle, /* NODE-TODO, vars*/);
		}

		// NODE-TODO if ( PerfMeasurement.ACTIVE ) PerfMeasurement.stop(PerfKeys.RESOLVE_MODULE);

		return previous.then( function() {
			log.verbose("  resolving bundle done");

			return resolved;
		});
	}
}


module.exports = BundleResolver;

