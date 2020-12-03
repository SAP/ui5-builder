const log = require("@ui5/logger").getLogger("builder:processors:versionInfoGenerator");
const resourceFactory = require("@ui5/fs").resourceFactory;
const path = require("path");

function pad(v) {
	return String(v).padStart(2, "0");
}
function getTimestamp() {
	const date = new Date();
	const year = date.getFullYear();
	const month = pad(date.getMonth() + 1);
	const day = pad(date.getDate());
	const hours = pad(date.getHours());
	const minutes = pad(date.getMinutes());
	// yyyyMMddHHmm
	return year + month + day + hours + minutes;
}


/**
 *
 * @param {module:@ui5/fs.Resource} manifestResource
 * @returns {Promise<ManifestInfos>}
 */
const processManifest = async (manifestResource) => {
	const manifestContent = await manifestResource.getString();
	const manifestObject = JSON.parse(manifestContent);
	const result = {
		embeds: [],
		libs: {},
		id: undefined
	};

	// sap.ui5/dependencies is used for the "manifestHints/libs"
	if (manifestObject["sap.ui5"]) {
		const manifestDependencies = manifestObject["sap.ui5"]["dependencies"];
		if (manifestDependencies) {
			Object.keys(manifestDependencies.libs).forEach((libKey) => {
				result.libs[libKey] = {};
				if (manifestDependencies.libs[libKey].lazy) {
					result.libs[libKey].lazy = true;
				}
			});
		}
	}

	// sap.app/embeds is used for "components"
	if (manifestObject["sap.app"]) {
		const manifestEmbeds = manifestObject["sap.app"]["embeds"];
		if (manifestEmbeds) {
			result.embeds = manifestEmbeds;
		}
		result.id = manifestObject["sap.app"]["id"];
	}
	return result;
};

/**
 * Library Info
 *
 * @typedef {object<string, object>} DependencyInfos
 *
 *  * @example
 * {
 *   sap.chart: {
 *       lazy: true
 *   },
 *   sap.f: { }
 * }
 */

/**
 * Manifest Hint
 *
 * @typedef {object} ManifestInfos
 * @property {DependencyInfos} libs The library object
 * @property {string[]} embeds embedded components, e.g. "sub/fold" (only relative path)
 * @property {string} id the app id, e.g. "lib.a"
 *
 *
 * @example
 * {
 *  libs: {
 *   sap.chart: {
 *       lazy: true
 *   },
 *   sap.f: { },
 *  },
 *  id: "lib.a",
 *  embeds: ["sub"]
 * }
 *
 */


/**
 * Library Info object
 *
 * @typedef {object} LibraryInfo
 * @property {string} name The library name
 * @property {string} version The library version
 * @property {module:@ui5/fs.Resource} mainManifest main manifest resources
 * @property {module:@ui5/fs.Resource[]} manifestResources list of corresponding manifest resources
 */

const getManifestPath = (filePath, subPath) => {
	if (filePath.endsWith("manifest.json")) {
		const folderPathOfManifest = filePath.substr(0, filePath.length - "manifest.json".length) + subPath;
		return path.posix.resolve(folderPathOfManifest + "/manifest.json");
	}
	return filePath;
};

/**
 *
 * @param {Map<string, DependencyInfos>} libraryInfosMap
 */
const resolveTransitiveDependencies = (libraryInfosMap) => {
	const keys = [...libraryInfosMap.keys()];
	keys.sort();
	const resolvedCache = new Map();
	keys.forEach((libName) => { // e.g. sap.ui.documentation
		resolve(libName, libraryInfosMap, resolvedCache);
	});
};

const clone = (obj) => {
	return JSON.parse(JSON.stringify(obj));
};

const merge = (existingEntry, newLibs) => {
	if (existingEntry) {
		Object.keys(existingEntry).forEach((libName) => {
			if (!existingEntry[libName].lazy && newLibs[libName] && newLibs[libName].lazy) {
				delete newLibs[libName].lazy;
			}
			if (!newLibs[libName]) {
				newLibs[libName] = existingEntry[libName];
			}
		});
	}
	return newLibs;
};

/**
 *
 * @param {string} libName
 * @param {Map<string, DependencyInfos>} libraryInfosMap
 * @param {Map<string, DependencyInfos>} alreadyProcessed
 * @returns {DependencyInfos} resolved dependencies
 */
const resolve = (libName, libraryInfosMap, alreadyProcessed, isLazy) => {
	// check already processed first
	if ( alreadyProcessed.has(libName)) {
		return alreadyProcessed.get(libName);
	}
	const manifestHint = libraryInfosMap.get(libName);
	let mergedDependencies = manifestHint;
	// cache
	alreadyProcessed.set(libName, mergedDependencies);
	if (!manifestHint) {
		log.error(`no manifest information in dependencies for ${libName}`); // TODO check
		alreadyProcessed.set(libName, {});
		return {};
	}
	const keys = Object.keys(manifestHint);
	keys.forEach((childLibName) => {
		const childResolved = resolve(childLibName, libraryInfosMap, alreadyProcessed, isLazy);
		// set a copy of the resolved libraries to avoid modifying it while iterating (recursively)
		mergedDependencies = merge(mergedDependencies, clone(childResolved), isLazy);
		// TODO add childResolved to resolved
		// TODO check cacles


		// TODO lib a (lazy) --> all its dependencies must be lazy
		// input
		// a -> b (lazy) -> c
		// output
		// a -> b (lazy), c (lazy)


		// a -> c, b (lazy)
		// b -> c (lazy)


		// a -> c, b (lazy)


		// a -> c (lazy), b (lazy)
		// b -> c

		// kette gewinnt lazy --> alle dependencies von einer lazy dep sind auch lazy
		// merge gewinnt eager


		// TODO put this into a classes to better structure the code
		// TODO instead of using a "global" map, have a Dependency as a class with a name
		// and the functionality to resolve its dependencies
		// ManifestHints -> resolve
	});

	libraryInfosMap.set(libName, mergedDependencies);


	return mergedDependencies;
};

/**
 * Sorts the keys of a given object
 *
 * @param {object} obj the object
 * @returns {{}}
 */
const sortObjectKeys = (obj) => {
	const sortedObject = {};
	const keys = Object.keys(obj);
	keys.sort();
	keys.forEach((key) => {
		sortedObject[key] = obj[key];
	});
	return sortedObject;
};

const addManifestHints = (result, libs) => {
	if (Object.keys(libs).length) {
		const sortedLibs = sortObjectKeys(libs);
		result.manifestHints = {
			dependencies: {
				libs: sortedLibs
			}
		};
	}
};

const processLibraryInfo = async (libraryInfo, dependencyInfoMap, embeddedInfoMap) => {
	const manifestInfo = await processManifest(libraryInfo.mainManifest);
	// gather shallow library information
	dependencyInfoMap.set(libraryInfo.name, manifestInfo.libs);
	const embeds = manifestInfo.embeds; // sdk
	// filter
	const embeddedPaths = embeds.map((embed) => {
		return getManifestPath(libraryInfo.mainManifest.getPath(), embed);
	});
	// sap.ui.documentation.sdk
	const relevantManifests = libraryInfo.manifestResources.filter((manifestResource) => {
		return embeddedPaths.includes(manifestResource.getPath());
	});

	// get all embedded manifests
	const embeddedManifestPromises = relevantManifests.map(async (relevantManifest) => {
		const result = await processManifest(relevantManifest);
		dependencyInfoMap.set(result.id, result.libs);
		embeddedInfoMap.set(result.id, {
			library: libraryInfo.name
		});
	});

	await Promise.all(embeddedManifestPromises);
};

/**
 * Creates sap-ui-version.json.
 *
 * @public
 * @alias module:@ui5/builder.processors.versionInfoGenerator
 * @param {object} parameters Parameters
 * @param {object} parameters.options Options
 * @param {string} parameters.options.rootProjectName Name of the root project
 * @param {string} parameters.options.rootProjectVersion Version of the root project
 * @param {LibraryInfo[]} parameters.options.libraryInfos Array of objects representing libraries,
 *  e.g. <code>
 *   {
 *      name: "library.xy",
 *      version: "1.0.0",
 *      mainManifest: module:@ui5/fs.Resource,
 *      manifestResources: module:@ui5/fs.Resource[]
 *   }
 * </code>
 * @returns {Promise<module:@ui5/fs.Resource[]>} Promise resolving with an array containing the versioninfo resource
 */

module.exports = async function({options}) {
	if (!options.rootProjectName || options.rootProjectVersion === undefined || options.libraryInfos === undefined) {
		throw new Error("[versionInfoGenerator]: Missing options parameters");
	}

	const buildTimestamp = getTimestamp();

	const components = {};
	/**
	 * @example
	 * {
	 *  "sap.ui.integration": {
	 *   "sap.chart": {
	 *       "lazy": true
	 *   },
	 *   "sap.f": { },
	 *  }
	 * }
	 *
	 * @type {Map<string, DependencyInfos>}
	 */
	const dependencyInfoMap = new Map();
	const embeddedInfoMap = new Map();

	// gather all manifestHints
	const librariesPromises = options.libraryInfos.map((libraryInfo) => {
		return processLibraryInfo(libraryInfo, dependencyInfoMap, embeddedInfoMap);
	});

	await Promise.all(librariesPromises);

	// resolve nested dependencies (transitive)
	resolveTransitiveDependencies(dependencyInfoMap);


	const libraries = options.libraryInfos.map((libraryInfo) => {
		const result = {
			name: libraryInfo.name,
			version: libraryInfo.version,
			buildTimestamp: buildTimestamp,
			scmRevision: ""// TODO: insert current library scm revision here
		};

		const libs = dependencyInfoMap.get(libraryInfo.name);
		addManifestHints(result, libs);
		return result;
	});

	// sort keys
	embeddedInfoMap.forEach((embeddedInfo, libName) => {
		components[libName] = embeddedInfo;
		const libs = dependencyInfoMap.get(libName);
		addManifestHints(components[libName], libs);
	});
	const sortedComponents = sortObjectKeys(components);

	// sort libraries alphabetically
	libraries.sort((a, b) => {
		return a.name.localeCompare(b.name);
	});

	const versionJson = {
		name: options.rootProjectName,
		version: options.rootProjectVersion, // TODO: insert current application version here
		buildTimestamp: buildTimestamp,
		scmRevision: "", // TODO: insert current application scm revision here
		// gav: "", // TODO: insert current application id + version here
		libraries,
		components: sortedComponents
	};

	return [resourceFactory.createResource({
		path: "/resources/sap-ui-version.json",
		string: JSON.stringify(versionJson, null, "\t")
	})];
};
