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
	keys.forEach((libName) => { // e.g. sap.ui.documentation
		const libraryInfo = libraryInfosMap.get(libName);
		libraryInfo.resolve(libraryInfosMap);
	});
};

class DependencyInfoObject {
	/**
	 *
	 * @param {string} name name of the dependency, e.g. sap.ui.documentation
	 * @param {boolean} lazy
	 */
	constructor(name, lazy) {
		this.name = name;
		this.lazy = lazy;
	}
}

class DependencyInfo {
	/**
	 *
	 * @param {DependencyInfoObject[]} libs
	 * @param {string} name
	 */
	constructor(libs, name) {
		this.libs = libs;
		this.name = name;

		/**
		 *
		 * @type {string[]}
		 */
		this.resolved = [];
		/**
		 *
		 * @type {DependencyInfoObject[]}
		 */
		this.libsResolved = [];
		this.wasResolved = false;
	}

	isResolved(libName) {
		return this.libsResolved.find((libResolved) => {
			return libResolved.name === libName;
		});
	}

	/**
	 *
	 * @param {string} libName
	 * @param {boolean} lazy
	 * @returns {DependencyInfoObject}
	 */
	addResolvedLibDependency(libName, lazy) {
		if (log.isLevelEnabled("verbose")) {
			log.verbose(`${this.name} add: ${libName}${lazy?" (lazy)":""}`);
		}
		let alreadyResolved = this.isResolved(libName);
		if (!alreadyResolved) {
			alreadyResolved = new DependencyInfoObject(libName, lazy);
			this.libsResolved.push(alreadyResolved);
		} else {
			if (!alreadyResolved.lazy || !lazy) {
				delete alreadyResolved.lazy;
			}
		}
		return alreadyResolved;
	}

	/**
	 *
	 * @param {Map<string,DependencyInfo>} dependencyInfoMap
	 * @param {boolean} [lazy]
	 */
	resolve(dependencyInfoMap, lazy) {
		if (!this.wasResolved || lazy) {
			log.verbose(`resolving ${this.name}`);
			this.libs.forEach((depInfoObject) => {
				const dependencyInfoObjectAdded = this.addResolvedLibDependency(depInfoObject.name, depInfoObject.lazy);
				const dependencyInfo = dependencyInfoMap.get(depInfoObject.name);
				dependencyInfo.resolve(dependencyInfoMap, dependencyInfoObjectAdded.lazy);

				dependencyInfo.libsResolved.forEach((resolvedLib) => {
					this.addResolvedLibDependency(resolvedLib.name, resolvedLib.lazy || dependencyInfoObjectAdded.lazy);
				});
			});
			this.wasResolved = true;
			if (log.isLevelEnabled("verbose")) {
				log.verbose(`resolved ${this.name}: ${this.libsResolved.map((lib) => {
					return `${this.name}: ${lib.name}${lib.lazy ? " (lazy)" : ""}`;
				}).join(", ")}`);
			}
		}
	}
}


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

/**
 *
 * @param {object} result
 * @param {DependencyInfo} dependencyInfo
 */
const addManifestHints = (result, dependencyInfo) => {
	if (dependencyInfo && dependencyInfo.libs.length) {
		// const sortedLibs = sortObjectKeys(libs.libs);
		const libsObject = {};
		dependencyInfo.libsResolved.forEach((sortedLib) => {
			libsObject[sortedLib.name] = {};
			if (sortedLib.lazy) {
				libsObject[sortedLib.name].lazy = true;
			}
		});
		result.manifestHints = {
			dependencies: {
				libs: libsObject
			}
		};
	}
};

const convertToDependencyInfoObjects = (libs) => {
	return Object.keys(libs).map((name) => {
		const lazy = libs[name].lazy === true;
		return new DependencyInfoObject(name, lazy);
	});
};

const processLibraryInfo = async (libraryInfo, dependencyInfoMap, embeddedInfoMap) => {
	if (!libraryInfo.mainManifest) {
		log.error(`library manifest not found for ${libraryInfo.name}`);
		return;
	}
	const manifestInfo = await processManifest(libraryInfo.mainManifest);
	// gather shallow library information
	const dependencyInfoObjects = convertToDependencyInfoObjects(manifestInfo.libs);
	dependencyInfoMap.set(libraryInfo.name, new DependencyInfo(dependencyInfoObjects, libraryInfo.name));
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
		const dependencyInfoObjects = convertToDependencyInfoObjects(result.libs);
		dependencyInfoMap.set(result.id, new DependencyInfo(dependencyInfoObjects, result.id));
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
	 * @type {Map<string, DependencyInfo>}
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
		libraries
	};
	if (Object.keys(sortedComponents).length) {
		versionJson.components = sortedComponents;
	}

	return [resourceFactory.createResource({
		path: "/resources/sap-ui-version.json",
		string: JSON.stringify(versionJson, null, "\t")
	})];
};
