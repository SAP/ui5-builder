"use strict";

const log = require("@ui5/logger").getLogger("builder:processors:resourceListCreator");
const ResourceFilterList = require("../lbt/resources/ResourceFilterList");
const LocatorResourcePool = require("../lbt/resources/LocatorResourcePool");


const EvoResource = require("@ui5/fs").Resource;

const DEBUG_RESOURCES_PATTERN = /-dbg((?:\.view|\.fragment|\.controller|\.designtime|\.support)?\.js|\.css)$/;

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
		this._module = null;
		this.required = null;
		this.condRequired = null;
		this.included = null;
		this.dynRequired = false;
		this.requiresTopLevelScope = false;
		this.exposedGlobalNames = null;
		this._format = null;
		this._size = -1;
	}


	get module() {
		return this._module;
	}

	set module(value) {
		this._module = value;
	}

	get format() {
		return this._format;
	}

	set format(value) {
		this._format = value;
	}

	get size() {
		return this._size;
	}

	set size(value) {
		this._size = value;
	}

	/**
	 * Copies the properties of the given ResourceInfo into this
	 *
	 * @param {string} prefix
	 * @param {ResourceInfo} orig
	 */
	copyFrom(prefix, orig) {
		this.i18nName = orig.i18nName == null ? null : ResourcesList.makePathRelativeTo(prefix, orig.i18nName);
		this.i18nLocale = orig.i18nLocale;
		this.isDebug = orig.isDebug;
		this.theme = orig.theme;
		this.merged = orig.merged;
		this.designtime = orig.designtime;
		this.support = orig.support;
		if ( this._module == null ) {
			this._module = orig._module;
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
		if ( orig.dynRequired ) {
			this.dynRequired = orig.dynRequired;
		}
		if ( orig.included != null ) {
			if ( this.included == null ) {
				this.included = new Set();
			}
			orig.included.forEach(this.included.add, this.included);
		}
		if ( this.included != null && this.included.size > 0 ) {
			this.merged = true;
		}
		if (orig.size >= 0) {
			this.size = orig.size;
		}
		if ( orig.requiresTopLevelScope ) {
			this.requiresTopLevelScope = orig.requiresTopLevelScope;
		}
		if ( orig.exposedGlobalNames != null ) {
			if ( this.exposedGlobalNames == null ) {
				this.exposedGlobalNames = new Set();
			}
			orig.exposedGlobalNames.forEach(this.exposedGlobalNames.add, this.exposedGlobalNames);
		}
		if ( orig._format != null ) {
			this._format = orig._format;
		}
	}

	/**
	 * called from JSON.stringify()
	 *
	 * @returns {{name: *}}
	 */
	toJSON() {
		const result = {
			name: this.name
		};
		if ( this._module != null ) {
			result.module = this._module;
		}
		if ( this.size >= 0 ) {
			result.size = this.size;
		}
		if ( this.requiresTopLevelScope ) {
			result.requiresTopLevelScope = this.requiresTopLevelScope;
		}
		if ( this.exposedGlobalNames != null && this.exposedGlobalNames.size > 0 ) {
			result.exposedGlobalNames = [...this.exposedGlobalNames];
		}
		if ( this._format ) {
			result.format = this._format;
		}

		//

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

		//

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
		/**
		 *
		 * @type {Map<string, ResourceInfo>}
		 */
		this.resourcesByName = new Map();
	}

	/**
	 * Add ResourceInfo to list
	 *
	 * @param {ResourceInfo} info
	 * @param {boolean} shareDebugInformation
	 */
	add(info, shareDebugInformation=true) {
		const relativeName = ResourcesList.makePathRelativeTo(this.name, info.name);

		// search for a resource with the same name
		let myInfo = this.resourcesByName.get(relativeName);

		if ( myInfo == null && shareDebugInformation) {
			// when not found, check if the given resource is a debug resource and share the information with the non-dbg version
			const nondbg = ResourcesList.getNonDebugName(relativeName);
			if ( nondbg != null && this.resourcesByName.has(nondbg) ) {
				myInfo = new ResourceInfo(relativeName);
				myInfo.copyFrom(this.name, this.resourcesByName.get(nondbg));
				this.resources.push(myInfo);
				this.resourcesByName.set(relativeName, myInfo);
			}
		}

		// this is the assumption, that the debug one is the same as the non-dbg one
		if ( myInfo == null ) {
			myInfo = new ResourceInfo(relativeName);
			myInfo.size = info.size;
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

/**
 * Hard coded debug bundle, to trigger  separate analysis for this __filename
 * because sap-ui-core.js and sap-ui-core-dbg.js have different includes
 *
 * @type {string[]}
 */
const DEBUG_BUNDLES = [
	"sap-ui-core-dbg.js"
];

const LOCALE = /^((?:[^/]+\/)*[^/]+?)_([A-Z]{2}(?:_[A-Z]{2}(?:_[A-Z0-9_]+)?)?)(\.properties|\.hdbtextbundle)$/i;
const THEME = /^((?:[^/]+\/)*)themes\/([^/]+)\//;

class ResourceCollector {
	constructor(pool, filter) {
		this._pool = pool;
		this._filter = filter != null ? filter : new ResourceFilterList();
		/**
		 * name to resource info
		 *
		 * @type {Map<string,ResourceInfo>}
		 */
		this._resources = new Map();

		/**
		 * prefix to ResourcesList
		 *
		 * @type {Map<string, ResourceList>}
		 * @private
		 */
		this._components = new Map();
		this._themePackages = new Map();
	}

	setExternalResources(list) {
		this._externalResources = list;
	}

	/**
	 * Processes a resource
	 *
	 * @param {string} virPath virtual path of the resource
	 * @param {number} sizeBytes size in bytes
	 */
	visitResource(virPath, sizeBytes) {
		if ( !virPath.startsWith("/resources/") ) {
			log.warn(`non-runtime resource ${virPath} ignored`);
			return;
		}
		const name = virPath.slice("/resources/".length);
		if ( this._filter.matches(name) ) {
			const resource = new ResourceInfo(name);
			resource.size = sizeBytes;
			this._resources.set(name, resource);

			const p = name.lastIndexOf("/");
			const prefix = name.substring(0, p + 1);
			const basename = name.substring(p + 1);
			if ( basename.match("[^/]*\\.library|Component\\.js|manifest\\.json") && !this._components.has(prefix) ) {
				this._components.set(prefix, new ResourcesList(prefix));
			}
			// a .theme file within a theme folder indicates a library/theme package
			// Note: ignores .theme files in library folders

			// .theming files are not always present therefore this check is relevant for the library.source.less
			if ( name.match("(?:[^/]+/)*themes/[^/]+/(?:\\.theming|library.source.less)") && !this._themePackages.has(prefix) ) {
				// log.info("found new theme package %s", prefix);
				this._themePackages.set(prefix, new ResourcesList(prefix));
			}
		}
	}

	async enrichWithDependencyInfo(resourceInfo) {
		return this._pool.getModuleInfo(resourceInfo.name).then((moduleInfo) => {
			if ( moduleInfo.name ) {
				resourceInfo.module = moduleInfo.name;
			}
			if ( moduleInfo.dynamicDependencies ) {
				resourceInfo.dynRequired = true;
			}
			if ( moduleInfo.dependencies.length > 0 ) {
				resourceInfo.required = resourceInfo.required || new Set();
				resourceInfo.condRequired = resourceInfo.condRequired || new Set();
				moduleInfo.dependencies.forEach((dep) => {
					if ( moduleInfo.isConditionalDependency(dep) ) {
						resourceInfo.condRequired.add(dep);
					} else if ( !moduleInfo.isImplicitDependency(dep) ) {
						resourceInfo.required.add(dep);
					}
				});
			}
			if ( moduleInfo.subModules.length > 0 ) {
				resourceInfo.included = resourceInfo.included || new Set();
				moduleInfo.subModules.forEach((mod) => {
					resourceInfo.included.add(mod);
				});
			}

			if (moduleInfo.requiresTopLevelScope) {
				resourceInfo.requiresTopLevelScope = true;
			}
			if (moduleInfo.exposedGlobals != null && moduleInfo.exposedGlobals.length) {
				resourceInfo.exposedGlobalNames = resourceInfo.exposedGlobalNames || new Set();
				moduleInfo.exposedGlobals.forEach((exposedGlobalName) => {
					resourceInfo.exposedGlobalNames.add(exposedGlobalName);
				});
			}

			if (moduleInfo.rawModule) {
				resourceInfo.format = "raw";
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
				log.verbose(`  found potential i18n resource '${name}', base name is '${baseName}', locale is ${m[2]}`);
				info.i18nName = baseName;
				info.i18nLocale = m[2];
				baseNames.add(baseName);
			}

			if ( m = THEME.exec(name) ) {
				// log.verbose("found theme candidate %s with prefix %s", name, m[1]);
				if ( this._themePackages.has(m[0]) ) {
					const theme = m[2];
					info.theme = theme;
					log.verbose(`  found potential theme resource '${name}', theme ${theme}`);
				}
			}

			if ( /(?:\.js|\.view.xml|\.control.xml|\.fragment.xml)$/.test(name) ) {
				promises.push(
					this.enrichWithDependencyInfo(info)
				);
			}

			// set the module name for .properties and .json
			if ( /(?:\.properties|\.json)$/.test(name) ) {
				promises.push(new Promise((resolve) => {
					return this._pool.getModuleInfo(info.name).then((moduleInfo) => {
						if (moduleInfo.name) {
							info.module = moduleInfo.name;
						}
						resolve();
					});
				}));
			}

			if ( debugFilter.matches(name) ) {
				info.isDebug = true;
				log.verbose(`  found potential debug resource '${name}'`);
			}

			if ( mergeFilter.matches(name) ) {
				info.merged = true;
				log.verbose(`  found potential merged resource '${name}'`);
			}

			if ( designtimeFilter.matches(name) ) {
				info.designtime = true;
				log.verbose(`  found potential designtime resource '${name}'`);
			}

			if ( supportFilter.matches(name) ) {
				info.support = true;
				log.verbose(`  found potential support resource '${name}'`);
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
		log.verbose(
			`  configured external resources filters (resources outside the namespace): ${this._externalResources == null ? "(none)" : this._externalResources}`);

		const filtersByComponent = new Map();

		if ( this._externalResources != null ) {
			for ( let [component, filters] of Object.entries(this._externalResources) ) {
				const packageFilters = new ResourceFilterList(filters);
				if ( component === "/" || component === "" ) {
					component = "";
				} else if ( !component.endsWith("/") ) {
					component += "/";
				}
				log.verbose(`	resulting filter list for '${component}': '${packageFilters}'`);
				filtersByComponent.set(component, packageFilters);
			}
		}
		return filtersByComponent;
	}

	groupResourcesByComponents(options) {
		const orphanFilters = this.createOrphanFilters();
		const debugBundlesFilter = ResourceFilterList.fromString(options.debugBundles);
		for (const resource of this._resources.values()) {
			let contained = false;
			for (const [prefix, list] of this._components.entries()) {
				const isDebugBundle = debugBundlesFilter.matches(resource.name);
				if ( resource.name.startsWith(prefix) ) {
					list.add(resource, !isDebugBundle);
					contained = true;
				} else if ( orphanFilters.has(prefix) ) {
					// log.verbose(`  checking '${resource.name}' against orphan filter '${orphanFilters.get(prefix)}' (${prefix})`);
					if ( orphanFilters.get(prefix).matches(resource.name) ) {
						list.add(resource, !isDebugBundle);
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

	/**
	 * Components
	 *
	 * @returns {Map<string, ResourceList>}
	 */
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


module.exports = async function({resources}, options) {
	options = Object.assign({
		failOnOrphans: true,
		externalResources: undefined,
		debugResources: DEFAULT_DEBUG_RESOURCES_FILTER.join(","),
		mergedResources: DEFAULT_BUNDLE_RESOURCES_FILTER.join(","),
		designtimeResources: DEFAULT_DESIGNTIME_RESOURCES_FILTER.join(","),
		supportResources: DEFAULT_SUPPORT_RESOURCES_FILTER.join(","),
		debugBundles: DEBUG_BUNDLES.join(",")
	}, options);

	const pool = new LocatorResourcePool();
	await pool.prepare( resources );

	const collector = new ResourceCollector(pool);
	const visitPromises = resources.map((resource) => {
		return resource.getSize().then((size) => {
			collector.visitResource(resource.getPath(), size);
		});
	});

	await Promise.all(visitPromises);
	log.verbose(`	found ${collector.resources.size} resources`);

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
	collector.groupResourcesByComponents({
		debugBundles: options.debugBundles
	});

	const resourceLists = [];

	// write out resources.json files
	for (const [prefix, list] of collector.components.entries()) {
		log.verbose(`	writing '${prefix}resources.json'`);

		// having the file size entry part of the file is a bit like the chicken egg scenario
		// you can't change the value of the file size without changing the file size
		// so this part here tries to cope with that.

		// try to add resources.json entry with previous size of the list string.
		// get the content to be added (resources.json entry)
		// modify the size of the entry from the calculated one

		let contentString = JSON.stringify(list, null, "\t");
		const resourcesJson = new ResourceInfo(prefix + "resources.json");
		// initial size
		resourcesJson.size = Buffer.from(contentString).byteLength;
		list.add(resourcesJson);

		contentString = JSON.stringify(list, null, "\t");

		let newLength = Buffer.from(contentString).byteLength;

		// Adjust size until it is correct
		// This entry's size depends on the file size which depends on this entry's size,...
		// Updating the number of the size in the content might influence the size of the file itself
		// This is deterministic because e.g. in the content -> <code>"size": 1000</code> has the same amount of bytes as <code>"size": 9999</code>
		// the difference might only come for:
		// * adding the initial entry of resources.json
		// * changes when the number of digits of the number changes, e.g. 100 -> 1000
		while (resourcesJson.size !== newLength) {
			resourcesJson.size = newLength;
			list.add(resourcesJson);
			contentString = JSON.stringify(list, null, "\t");
			newLength = Buffer.from(contentString).byteLength;
		}

		resourceLists.push(new EvoResource({
			path: `/resources/${prefix}resources.json`,
			string: contentString
		}));
	}
	for (const [prefix, list] of collector.themePackages.entries()) {
		log.verbose(`	writing '${prefix}resources.json'`);
		resourceLists.push(new EvoResource({
			path: `/resources/${prefix}resources.json`,
			string: JSON.stringify(list, null, "\t")
		}));
	}
	const unassigned = collector.resources;
	if ( unassigned.size > 0 ) {
		log.verbose(`  found ${unassigned.size} resources not belonging to a component (orphans)`);
		let n = 0;
		for ( const resource of unassigned ) {
			log.verbose(`    ${resource} (orphan)`);
			if ( ++n > 20 ) {
				log.verbose(`        ... (${unassigned.size - n} more)`);
				break;
			}
		}
		if ( options.failOnOrphans ) {
			throw new Error("not all resources could be assigned to components");
		}
	}

	return resourceLists;
};
