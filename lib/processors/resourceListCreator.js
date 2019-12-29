"use strict";

const log = require("@ui5/logger").getLogger("builder:processors:resourceListCreator");
const ResourceFilterList = require("../lbt/resources/ResourceFilterList");
const Resource = require("../lbt/resources/Resource");
const ResourcePool = require("../lbt/resources/ResourcePool");
const EvoResource = require("@ui5/fs").Resource;

const DEBUG_RESOURCES_PATTERN = /-dbg((?:\.view|\.fragment|\.controller|\.designtime|\.support)?\.js|\.css)$/;

// TODO share with module bundler

function extractName(path) {
	return path.slice( "/resources/".length);
}

class LocatorResource extends Resource {
	constructor(pool, resource) {
		super(pool, extractName(resource.getPath()), null, resource.getStatInfo());
		this.resource = resource;
	}

	buffer() {
		return this.resource.getBuffer();
	}

	getProject() {
		return this.resource._project;
	}
}

class LocatorResourcePool extends ResourcePool {
	constructor() {
		super();
	}

	prepare(resources) {
		resources = resources.filter( (res) => !res.getStatInfo().isDirectory() );
		// console.log(resources.map($ => $.getPath()));
		return Promise.all(
			resources.map(
				(resource) => this.addResource( new LocatorResource(this, resource) )
			).filter( (followUp) => followUp )
		);
		// .then( () => {
		// 	console.log("  found %d resources", this.size);
		// });
	}
}

/**
 * Information about a single resource as stored in the resources.json file.
 *
 * @author Frank Weigel
 * @since 1.33.0
 */
class ResourceInfo {
	constructor(name) {
		this.name = name;
		this.i18nName = null;
		this.i18nLocale = null;
		this.isDebug = false;
		this.theme = null;
		this.merged = false;
		this.designtime = false;
		this.support = false;
		this.module = null;
		this.required = null;
		this.condRequired = null;
		this.included = null;
		this.dynRequired = false;
	}

	copyFrom(prefix, orig) {
		this.i18nName = orig.i18nName == null ? null : ResourcesList.makePathRelativeTo(prefix, orig.i18nName);
		this.i18nLocale = orig.i18nLocale;
		this.isDebug = orig.isDebug;
		this.theme = orig.theme;
		this.merged = orig.merged;
		this.designtime = orig.designtime;
		this.support = orig.support;
		if ( this.module == null ) {
			this.module = orig.module;
		}
		if ( orig.required != null ) {
			if ( this.required == null ) {
				this.required = new Set();
			}
			orig.required.forEach(this.required.add, this.required);
		}
		if ( orig.condRequired != null ) {
			if ( this.condRequired == null ) {
				this.condRequired = new Set();
			}
			orig.condRequired.forEach(this.condRequired.add, this.condRequired);
		}
		this.dynRequired = orig.dynRequired;
		if ( orig.included != null ) {
			if ( this.included == null ) {
				this.included = new Set();
			}
			orig.included.forEach(this.included.add, this.included);
		}
		if ( this.included != null && this.included.size > 0 ) {
			this.merged = true;
		}
	}

	toJSON() {
		const result = {
			name: this.name
		};
		if ( this.module != null ) {
			result.module = this.module;
		}
		if ( this.isDebug ) {
			result.isDebug = this.isDebug;
		}
		if ( this.merged ) {
			result.merged = this.merged;
		}
		if ( this.designtime ) {
			result.designtime = this.designtime;
		}
		if ( this.support ) {
			result.support = this.support;
		}
		if ( this.i18nLocale != null ) {
			result.locale = this.i18nLocale;
			result.raw = this.i18nName;
		}
		if ( this.theme != null ) {
			result.theme = this.theme;
		}
		if ( this.required != null && this.required.size > 0 ) {
			result.required = [...this.required].sort();
		}
		if ( this.condRequired != null && this.condRequired.size > 0 ) {
			result.condRequired = [...this.condRequired].sort();
		}
		if ( this.dynRequired ) {
			result.dynRequired = this.dynRequired;
		}
		if ( this.included != null && this.included.size > 0 ) {
			result.included = [...this.included];
		}
		return result;
	}

	isEmpty() {
		return this.i18nLocale == null && this.i18nName == null && this.isDebug == false && this.theme == null && this.merged == false;
	}
}

/**
 * A list of ResourceInfo objects, suitable for (but not dependent on) JSON serialization.
 *
 * @author Frank Weigel
 * @since 1.33.0
 */
class ResourcesList {
	constructor(prefix) {
		/**
		 * List of resources information objects
		 */
		this.resources = [];

		// --- transient state ---
		this.name = prefix;
		this.resourcesByName = new Map();
	}

	add(info) {
		const relativeName = ResourcesList.makePathRelativeTo(this.name, info.name);

		// search for a resource with the same name
		let myInfo = this.resourcesByName.get(relativeName);

		if ( myInfo == null ) {
			// when not found, check if the given resource is a debug resource and share the information with the non-dbg version
			const nondbg = ResourcesList.getNonDebugName(relativeName);
			if ( nondbg != null && this.resourcesByName.has(nondbg) ) {
				myInfo = new ResourceInfo(relativeName);
				myInfo.copyFrom(this.name, this.resourcesByName.get(nondbg));
				this.resources.push(myInfo);
				this.resourcesByName.set(relativeName, myInfo);
			}
		}
		if ( myInfo == null ) {
			myInfo = new ResourceInfo(relativeName);
			this.resources.push(myInfo);
			this.resourcesByName.set(relativeName, myInfo);
		}
		myInfo.copyFrom(this.name, info);
	}

	toJSON() {
		this.resources.sort((a, b) => {
			if ( a.name === b.name ) {
				return 0;
			}
			return a.name < b.name ? -1 : 1;
		});
		return {
			/**
			 * Version of the resources.json file format, must be 1.1.0 or higher to store dependencies
			 */
			_version: "1.1.0",
			resources: this.resources
		};
	}

	static makePathRelativeTo(prefix, name) {
		let back = "";
		while ( !name.startsWith(prefix) ) {
			const p = prefix.lastIndexOf("/", prefix.length - 2);
			back = back + "../";
			if ( p >= 0 ) {
				prefix = prefix.slice(0, p + 1);
			} else {
				prefix = "";
				break;
			}
		}
		return back + name.slice(prefix.length);
	}

	/**
	 * If the given module is a -dbg file, calculate and return the non-dbg name.
	 *
	 * @param {string} path
	 * @returns {string|null} Non-debug name of the module
	 */
	static getNonDebugName(path) {
		if ( DEBUG_RESOURCES_PATTERN.test(path) ) {
			return path.replace( DEBUG_RESOURCES_PATTERN, "$1");
		}
		return null;
	}
}

/**
 * Collects all resources in a set of resource folders or from an archive
 * and writes a 'resources.json' file for each component or library
 * that can be found in the resources.
 *
 * @since 1.29.0
 */

/* NODE-TODO
	/**
	 * Global filters that should be taken into account when collecting resources.
	 *
	 * Each filter entry can be a comma separated list of simple filters. Each simple filter
	 * can be a pattern in resource name pattern syntax: A double asterisk '&0x2a;&0x2a;/' denotes an arbitrary
	 * number of resource name segments (folders) incl. a trailing slash, whereas a simple asterisk '*'
	 * denotes an arbitrary number of resource name characters, but not the segment separator '/'.
	 * A dot is interpreted as a dot, all other special regular expression characters keep their
	 * special meaning. This is a mixture of ANT-style path patterns and regular expressions.
	 *
	 * Excludes can be denoted by a leading '-' or '!', includes optionally by a leading '+'.
	 * Order of filters is significant, a later exclusion overrides an earlier inclusion
	 * and vice versa.
	 *
	 * Example:
	 * <pre>
	 *	 !sap/ui/core/
	 *	 +sap/ui/core/utils/
	 * </pre>
	 * excludes everything from sap/ui/core, but includes everything from the subpackage sap/ui/core/utils/.
	 *
	 * Note that the filter operates on the full name of each resource. If a resource name
	 * <code>prefix</code> is configured for a resource set, the filter will be applied
	 * to the combination of prefix and local file path and not only to the local file path.
	 * /
	@Parameter
	private String[] filters;

	/**
	 * Whether the default filters should be ignored when filters are given.
	 * /
	@Parameter(defaultValue="true")
	private boolean ignoreDefaultFilters = true;

	/**
	 * Comma separated list of components to which orphaned resources should be added.
	 *
	 * If a component contains a colon, everything behind the colon is interpreted as a semicolon
	 * separated list of resource patterns of orphans that should be added to the preceeding component.
	 * If no such list is given, any orphaned resource will be added to the component.
	 * The evaluation logic for the filter list is the same as for the <code>filters</code>
	 * parameters: excludes can be denoted with a leading '-' or '!' and order is significant.
	 * Later filters can override the result of earlier ones.
	 *
	 * If no component is given, orphans will only be reported but not added to any component (default).
	 *
	 * @since 1.29.1
	 * /
	@Parameter
	private String externalResources;
*/

/**
 * List of resource patterns that describe all debug resources.
 *
 * @since 1.29.1
 */
const DEFAULT_DEBUG_RESOURCES_FILTER = [
	"**/*-dbg.js",
	"**/*-dbg.controller.js",
	"**/*-dbg.designtime.js",
	"**/*-dbg.support.js",
	"**/*-dbg.view.js",
	"**/*-dbg.fragment.js",
	"**/*-dbg.css",
	"**/*.js.map"
];

/**
 * List of resource patterns that describe bundled resources.
 *
 * @since 1.29.1
 */
const DEFAULT_BUNDLE_RESOURCES_FILTER = [
	"**/Component-preload.js",
	"**/library-preload.js",
	"**/library-preload-dbg.js",
	"**/library-preload.json",
	"**/library-h2-preload.js",
	"**/designtime/library-preload.designtime.js",
	"**/library-preload.support.js",
	"**/library-all.js",
	"**/library-all-dbg.js"
];

/**
 * List of resource patterns that describe all designtime resources.
 *
 * @since 1.31.0
 */
const DEFAULT_DESIGNTIME_RESOURCES_FILTER = [
	"**/designtime/*",
	"**/*.designtime.js",
	"**/*.control",
	"**/*.interface",
	"**/*.type",
	"**/themes/*/*.less",
	"**/library.templates.xml",
	"**/library.dependencies.xml",
	"**/library.dependencies.json"
];

/**
 * List of resource patterns that describe all support (assistant) resources.
 *
 * @since 1.53.0
 */
const DEFAULT_SUPPORT_RESOURCES_FILTER = [
	"**/*.support.js"
];

const LOCALE = /^((?:[^/]+\/)*[^/]+?)_([A-Z]{2}(?:_[A-Z]{2}(?:_[A-Z0-9_]+)?)?)(\.properties|\.hdbtextbundle)$/i;
const THEME = /^((?:[^/]+\/)*)themes\/([^/]+)\//;

class ResourceCollector {
	constructor(pool, filter) {
		this._pool = pool;
		this._filter = filter != null ? filter : new ResourceFilterList();
		this._resources = new Map();
		this._components = new Map();
		this._themePackages = new Map();
	}

	setExternalResources(list) {
		this._externalResources = list;
	}

	visitResource(virPath) {
		if ( !virPath.startsWith("/resources/") ) {
			log.warn(`non-runtime resource ${virPath} ignored`);
			return;
		}
		const name = virPath.slice("/resources/".length);
		if ( this._filter.matches(name) ) {
			this._resources.set(name, new ResourceInfo(name));

			const p = name.lastIndexOf("/");
			const prefix = name.substring(0, p + 1);
			const basename = name.substring(p + 1);
			if ( basename.match("[^/]*\\.library|Component\\.js|manifest\\.json") && !this._components.has(prefix) ) {
				this._components.set(prefix, new ResourcesList(prefix));
			}
			// a .theme file within a theme folder indicates a library/theme package
			// Note: ignores .theme files in library folders
			if ( name.match("(?:[^/]+/)*themes/[^/]+/(?:\\.theming|library.source.less)") && !this._themePackages.has(prefix) ) {
				// log.info("found new theme package %s", prefix);
				this._themePackages.set(prefix, new ResourcesList(prefix));
			}
		}
	}

	async enrichWithDependencyInfo(resourceInfo) {
		return this._pool.getModuleInfo(resourceInfo.name).then((info) => {
			if ( info.name ) {
				resourceInfo.module = info.name;
			}
			if ( info.dynamicDependencies ) {
				resourceInfo.dynRequired = true;
			}
			if ( info.dependencies.length > 0 ) {
				resourceInfo.required = resourceInfo.required || new Set();
				resourceInfo.condRequired = resourceInfo.condRequired || new Set();
				info.dependencies.forEach((dep) => {
					if ( info.isConditionalDependency(dep) ) {
						resourceInfo.condRequired.push(dep);
					} else if ( !info.isImplicitDependency(dep) ) {
						resourceInfo.required.add(dep);
					}
				});
			}
			if ( info.subModules.length > 0 ) {
				resourceInfo.included = resourceInfo.included || new Set();
				info.subModules.forEach((mod) => {
					resourceInfo.included.add(mod);
				});
			}
		});
	}

	async determineResourceDetails({pool, debugResources, mergedResources, designtimeResources, supportResources}) {
		const baseNames = new Set();
		const debugFilter = ResourceFilterList.fromString(debugResources);
		const mergeFilter = ResourceFilterList.fromString(mergedResources);
		const designtimeFilter = ResourceFilterList.fromString(designtimeResources);
		const supportFilter = ResourceFilterList.fromString(supportResources);

		const promises = [];

		for (const [name, info] of this._resources.entries()) {
			// log.verbose(`  checking ${name}`);
			let m;
			if ( m = LOCALE.exec(name) ) {
				const baseName = m[1] + m[3];
				log.verbose("  found potential i18n resource '%s', base name is '%s', locale is %s", name, baseName, m[2]);
				info.i18nName = baseName;
				info.i18nLocale = m[2];
				baseNames.add(baseName);
			}

			if ( m = THEME.exec(name) ) {
				// log.verbose("found theme candidate %s with prefix %s", name, m[1]);
				if ( this._themePackages.has(m[0]) ) {
					const theme = m[2];
					info.theme = theme;
					log.verbose("  found potential theme resource '%s', theme %s", name, theme);
				}
			}

			if ( /(?:\.js|\.view.xml|\.control.xml|\.fragment.xml)$/.test(name) ) {
				promises.push(
					this.enrichWithDependencyInfo(info)
				);
			}

			if ( debugFilter.matches(name) ) {
				info.isDebug = true;
				log.verbose("  found potential debug resource '%s'", name);
			}

			if ( mergeFilter.matches(name) ) {
				info.merged = true;
				log.verbose("  found potential merged resource '%s'", name);
			}

			if ( designtimeFilter.matches(name) ) {
				info.designtime = true;
				log.verbose("  found potential designtime resource '%s'", name);
			}

			if ( supportFilter.matches(name) ) {
				info.support = true;
				log.verbose("  found potential support resource '%s'", name);
			}
		}

		for (const baseName of baseNames) {
			if ( this._resources.has(baseName) ) {
				const info = this._resources.get(baseName);
				info.i18nName = baseName;
				info.i18nLocale = "";
			}
		}

		return Promise.all(promises);
	}

	createOrphanFilters() {
		log.verbose("	configured external resources filters (resources outside the namespace): %s", this.externalResources == null ? "(none)" : this.externalResources);

		const filters = new Map();

		if ( this._externalResources != null && !this._externalResources.isEmpty() ) {
			/*
			Collection<String> componentsToProcess = new HashSet<String>(Arrays.asList(this.externalResources.trim().split("\\s*,\\s*")));

			for ( String component : componentsToProcess ) {
				ResourceFilterList packageFilters = null;
				int p = component.indexOf(':');
				if ( p > 0 ) {
					String packages = component.substring(p+1).trim();
					component = component.substring(0, p).trim();
					if ( packages != null ) {
						packageFilters = new ResourceFilterList().addFilters(packages.trim().split("\\s*;\\s*"));
					}
				}
				if ( component.equals("/") || component.isEmpty() ) {
					component = "";
				} else if ( !component.endsWith("/") ) {
					component += "/";
				}
				log.verbose("	resulting filter list for '%s': '%s'", component, packageFilters);
				filters.put(component, packageFilters);
			}
			*/
		}
		return filters;
	}

	groupResourcesByComponents() {
		const orphanFilters = this.createOrphanFilters();

		for (const resource of this._resources.values()) {
			let contained = false;
			for (const [prefix, list] of this._components.entries()) {
				if ( resource.name.startsWith(prefix) ) {
					list.add(resource);
					contained = true;
				} else if ( orphanFilters.has(prefix) ) {
					//						if ( log.isDebug() ) {
					//							log.verbose("	checking '%s' against orphan filter '%s' (%s)", resource.name, orphanFilters.get(prefix), prefix);
					//						}
					if ( orphanFilters.get(prefix).matches(resource.name) ) {
						list.add(resource);
						contained = true;
					}
				}
			}

			if ( resource.theme != null ) {
				// assign theme resources additionally to theme packages
				for (const [prefix, list] of this._themePackages.entries()) {
					if ( resource.name.startsWith(prefix) ) {
						list.add(resource);
						contained = true;
					}
				}
			}

			if ( contained ) {
				this._resources.delete(resource.name);
			}
		}
	}

	get resources() {
		return new Set(this._resources.keys());
	}

	get components() {
		return this._components;
	}

	get themePackages() {
		return this._themePackages;
	}
}

/**
 * Whether the detection of orphans should result in a build failure.
 *
 * @since 1.29.1
 */

module.exports = async function({resources, dependencyResources}, options) {
	options = Object.assign({
		failOnOrphans: true,
		externalResources: undefined,
		debugResources: DEFAULT_DEBUG_RESOURCES_FILTER.join(","),
		mergedResources: DEFAULT_BUNDLE_RESOURCES_FILTER.join(","),
		designtimeResources: DEFAULT_DESIGNTIME_RESOURCES_FILTER.join(","),
		supportResources: DEFAULT_SUPPORT_RESOURCES_FILTER.join(",")
	}, options);

	const pool = new LocatorResourcePool();
	await pool.prepare( resources.concat(dependencyResources) );

	const collector = new ResourceCollector(pool);
	resources.forEach((resource) => collector.visitResource(resource.getPath()));
	log.info("	found %d resources", collector.resources.size);

	// determine additional information for the found resources
	if ( options && options.externalResources ) {
		collector.setExternalResources(options.externalResources);
	}
	await collector.determineResourceDetails({
		pool,
		debugResources: options.debugResources,
		mergedResources: options.mergedResources,
		designtimeResources: options.designtimeResources,
		supportResources: options.supportResources
	});

	// group resources by components and create ResourcesLists
	collector.groupResourcesByComponents();

	const resourceLists = [];

	// write out resources.json files
	for (const [prefix, list] of collector.components.entries()) {
		log.info(`	writing '${prefix}resources.json'`);
		resourceLists.push(new EvoResource({
			path: `/resources/${prefix}resources.json`,
			string: JSON.stringify(list, null, "\t")
		}));
	}
	for (const [prefix, list] of collector.themePackages.entries()) {
		log.info(`	writing '${prefix}resources.json'`);
		resourceLists.push(new EvoResource({
			path: `/resources/${prefix}resources.json`,
			string: JSON.stringify(list, null, "\t")
		}));
	}
	const unassigned = collector.resources;
	if ( unassigned.size > 0 ) {
		log.warn(`  found ${unassigned.size} resources not belonging to a component (orphans)`);
		let n = 0;
		for ( const resource of unassigned ) {
			log.verbose(`    ${resource} (orphan)`);
			if ( ++n > 20 ) {
				log.verbose("		... (%d more)", unassigned.size - n);
				break;
			}
		}
		if ( options.failOnOrphans ) {
			throw new Error("not all resources could be assigned to components");
		}
	}

	return resourceLists;
};
