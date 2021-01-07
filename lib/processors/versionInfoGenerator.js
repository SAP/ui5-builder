const log = require("@ui5/logger").getLogger("builder:processors:versionInfoGenerator");
const resourceFactory = require("@ui5/fs").resourceFactory;
const posixPath = require("path").posix;

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

class ManifestInfo {
	constructor() {
		this.libs = {};
		this.embeds = [];
	}

	/**
	 * The library object
	 *
	 * @param {ManifestLibs} libs
	 */
	setLibs(libs) {
		this.libs = libs;
	}

	/**
	 * embedded components, e.g. "sub/fold" (only relative path)
	 *
	 * @param {string[]} embeds
	 */
	setEmbeds(embeds) {
		this.embeds = embeds;
	}

	/**
	 * relative path to the component which embeds this component
	 *
	 * @param {string} embeddedBy
	 */
	setEmbeddedBy(embeddedBy) {
		this.embeddedBy = embeddedBy;
	}

	/**
	 * the app id, e.g. "lib.a"
	 *
	 * @param {string} id
	 */
	setId(id) {
		this.id = id;
	}
}

/**
 * Processes manifest resource and extracts information
 *
 * @param {module:@ui5/fs.Resource} manifestResource
 * @returns {Promise<ManifestInfo>}
 */
const processManifest = async (manifestResource) => {
	const manifestContent = await manifestResource.getString();
	const manifestObject = JSON.parse(manifestContent);
	const result = new ManifestInfo();

	// sap.ui5/dependencies is used for the "manifestHints/libs"
	if (manifestObject["sap.ui5"]) {
		const manifestDependencies = manifestObject["sap.ui5"]["dependencies"];
		if (manifestDependencies) {
			const libs = {};
			Object.keys(manifestDependencies.libs).forEach((libKey) => {
				libs[libKey] = {};
				if (manifestDependencies.libs[libKey].lazy) {
					libs[libKey].lazy = true;
				}
			});
			result.setLibs(libs);
		}
	}

	// sap.app/embeds is used for "components"
	if (manifestObject["sap.app"]) {
		const manifestEmbeds = manifestObject["sap.app"]["embeds"];
		if (manifestEmbeds) {
			result.setEmbeds(manifestEmbeds);
		}

		const manifestEmbeddedBy = manifestObject["sap.app"]["embeddedBy"];
		if (manifestEmbeddedBy) {
			result.setEmbeddedBy(manifestEmbeddedBy);
		}
		result.setId(manifestObject["sap.app"]["id"]);
	}
	return result;
};

const isBundledWithLibrary = (embeddedBy, componentPath, libraryPathPrefix) => {
	if (typeof embeddedBy === "undefined") {
		log.verbose("  component doesn't declare 'sap.app/embeddedBy', don't list it as 'embedded'");
		return false;
	}
	if (typeof embeddedBy !== "string") {
		log.error(
			"  component '%s': property 'sap.app/embeddedBy' is of type '%s' (expected 'string'), " +
			"it won't be listed as 'embedded'", componentPath, typeof embeddedBy
		);
		return false;
	}
	if ( !embeddedBy.length ) {
		log.error(
			"  component '%s': property 'sap.app/embeddedBy' has an empty string value (which is invalid), " +
			"it won't be listed as 'embedded'", componentPath
		);
		return false;
	}
	let resolvedEmbeddedBy = posixPath.resolve(componentPath, embeddedBy);
	if ( resolvedEmbeddedBy && !resolvedEmbeddedBy.endsWith("/") ) {
		resolvedEmbeddedBy = resolvedEmbeddedBy + "/";
	}
	if ( libraryPathPrefix === resolvedEmbeddedBy ) {
		log.verbose("  component's 'sap.app/embeddedBy' property points to library, list it as 'embedded'");
		return true;
	} else {
		log.verbose(
			"  component's 'sap.app/embeddedBy' points to '%s', don't list it as 'embedded'", resolvedEmbeddedBy
		);
		return false;
	}
};

/**
 * Manifest libraries
 *
 * @typedef {object<string, object>} ManifestLibs
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
 * Library Info
 *
 * contains information about the name the version of the library and its manifest, as well as the nested manifests.
 *
 * @typedef {object} LibraryInfo
 * @property {string} name The library name
 * @property {string} version The library version
 * @property {module:@ui5/fs.Resource} libraryManifest main manifest resources
 * @property {module:@ui5/fs.Resource[]} manifestResources list of corresponding manifest resources
 */

/**
 *
 * @param {string} filePath
 * @param {string} subPath
 * @returns {string} manifest path
 */
const getManifestPath = (filePath, subPath) => {
	if (filePath.endsWith("manifest.json")) {
		const folderPathOfManifest = filePath.substr(0, filePath.length - "manifest.json".length) + subPath;
		return posixPath.resolve(folderPathOfManifest + "/manifest.json");
	}
	return filePath;
};

/**
 * Resolves the dependencies recursively
 *
 * @param {Map<string, DependencyInfo>} dependencyInfoMap
 */
const resolveTransitiveDependencies = (dependencyInfoMap) => {
	const keys = [...dependencyInfoMap.keys()];
	keys.sort();
	keys.forEach((libName) => { // e.g. sap.ui.documentation
		const libraryInfo = dependencyInfoMap.get(libName);
		libraryInfo.resolve(dependencyInfoMap);
	});
};

class DependencyInfoObject {
	/**
	 *
	 * @param {string} name name of the dependency, e.g. sap.ui.documentation
	 * @param {boolean} lazy lazy dependency
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
	 * @param {boolean} [lazy] whether or not the dependency is lazy dependency which means
	 *  all its dependencies should be treated as lazy
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
 * @param {DependencyInfo} dependencyInfo
 * @returns {object} manifestHints
 */
const getManifestHints = (dependencyInfo) => {
	if (dependencyInfo && dependencyInfo.libs.length) {
		const libsObject = {};
		dependencyInfo.libsResolved.forEach((sortedLib) => {
			libsObject[sortedLib.name] = {};
			if (sortedLib.lazy) {
				libsObject[sortedLib.name].lazy = true;
			}
		});
		return {
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

class ArtifactInfo {
	/**
	 *
	 * @param {string} componentName
	 */
	constructor(componentName) {
		this.componentName = componentName;
	}

	/**
	 *
	 * @param {DependencyInfo} dependencyInfo
	 */
	setDependencyInfo(dependencyInfo) {
		this.dependencyInfo = dependencyInfo;
	}

	/**
	 *
	 * @param {Set<string>} bundledComponents
	 */
	setBundledComponents(bundledComponents) {
		this.bundledComponents = bundledComponents;
	}

	/**
	 *
	 * @param {ArtifactInfo[]} artifactInfos
	 */
	setEmbeds(artifactInfos) {
		this.artifactInfos = artifactInfos;
		this.artifactInfos.forEach((artifactInfo) => {
			artifactInfo._setParent(this);
		});
	}

	/**
	 *
	 * @returns {ArtifactInfo[]}
	 */
	getEmbeds() {
		if (this.artifactInfos) {
			return this.artifactInfos;
		}
		return [];
	}

	/**
	 *
	 * @returns {Set<string>} bundledComponents
	 */
	getParentBundledComponents() {
		if (this.parent && this.parent.bundledComponents) {
			return this.parent.bundledComponents;
		}
		return new Set();
	}

	/**
	 *
	 * @returns {string}
	 */
	getParentComponentName() {
		if (this.parent) {
			return this.parent.componentName;
		}
	}

	/**
	 *
	 * @param {ArtifactInfo} parent
	 * @private
	 */
	_setParent(parent) {
		this.parent = parent;
	}
}

/**
 * Processes the library info and fills the maps <code>dependencyInfoMap</code> and <code>embeddedInfoMap</code>.
 *
 * @param {LibraryInfo} libraryInfo
 * @returns {Promise<ArtifactInfo[]>}
 */
const processLibraryInfo = async (libraryInfo) => {
	const artifactInfos = [];
	if (!libraryInfo.libraryManifest) {
		log.error(`library manifest not found for ${libraryInfo.name}`);
		return artifactInfos;
	}

	const manifestInfo = await processManifest(libraryInfo.libraryManifest);
	// gather shallow library information
	const dependencyInfoObjects = convertToDependencyInfoObjects(manifestInfo.libs);

	const mainArtifactInfo = new ArtifactInfo(libraryInfo.name);
	mainArtifactInfo.setDependencyInfo(new DependencyInfo(dependencyInfoObjects, libraryInfo.name));
	artifactInfos.push(mainArtifactInfo);

	const bundledComponents = new Set();
	mainArtifactInfo.setBundledComponents(bundledComponents);

	const embeds = manifestInfo.embeds; // sdk
	// filter
	const embeddedPaths = embeds.map((embed) => {
		return getManifestPath(libraryInfo.libraryManifest.getPath(), embed);
	});
	// sap.ui.documentation.sdk
	const relevantManifests = libraryInfo.manifestResources.filter((manifestResource) => {
		return embeddedPaths.includes(manifestResource.getPath());
	});

	// get all embedded manifests
	const embeddedManifestPromises = relevantManifests.map(async (relevantManifest) => {
		const fullManifestPath = posixPath.dirname(relevantManifest.getPath());
		const libraryPathPrefix = posixPath.dirname(libraryInfo.libraryManifest.getPath());

		const result = await processManifest(relevantManifest);
		const dependencyInfoObjects = convertToDependencyInfoObjects(result.libs);
		const componentName = result.id;
		const componentArtifactInfo = new ArtifactInfo(componentName);
		componentArtifactInfo.setDependencyInfo(new DependencyInfo(dependencyInfoObjects, componentName));

		if (isBundledWithLibrary(result.embeddedBy, fullManifestPath, libraryPathPrefix + "/")) {
			bundledComponents.add(componentName);
		}
		return componentArtifactInfo;
	});

	const embeddedArtifactInfos = await Promise.all(embeddedManifestPromises);
	mainArtifactInfo.setEmbeds(embeddedArtifactInfos);

	return artifactInfos;
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
 *      libraryManifest: module:@ui5/fs.Resource,
 *      manifestResources: module:@ui5/fs.Resource[]
 *   }
 * </code>
 * @returns {Promise<module:@ui5/fs.Resource[]>} Promise resolving with an array containing the versionInfo resource
 */

module.exports = async function({options}) {
	if (!options.rootProjectName || options.rootProjectVersion === undefined || options.libraryInfos === undefined) {
		throw new Error("[versionInfoGenerator]: Missing options parameters");
	}

	const buildTimestamp = getTimestamp();

	const components = {};
	/**
	 * componentName to dependency info
	 *
	 * @type {Map<string, DependencyInfo>}
	 */
	const dependencyInfoMap = new Map();


	// gather all manifestHints
	const librariesPromises = options.libraryInfos.map((libraryInfo) => {
		return processLibraryInfo(libraryInfo);
	});

	const artifactInfosPromises = await Promise.all(librariesPromises);
	const artifactInfos = [].concat(...artifactInfosPromises);
	artifactInfos.forEach((artifactInfo) => {
		dependencyInfoMap.set(artifactInfo.componentName, artifactInfo.dependencyInfo);
		artifactInfo.getEmbeds().forEach((embeddedArtifactInfo) => {
			dependencyInfoMap.set(embeddedArtifactInfo.componentName, embeddedArtifactInfo.dependencyInfo);
		});
	});

	// resolve nested dependencies (transitive)
	resolveTransitiveDependencies(dependencyInfoMap);


	const libraries = options.libraryInfos.map((libraryInfo) => {
		const result = {
			name: libraryInfo.name,
			version: libraryInfo.version,
			buildTimestamp: buildTimestamp,
			scmRevision: ""// TODO: insert current library scm revision here
		};

		const dependencyInfo = dependencyInfoMap.get(libraryInfo.name);
		const manifestHints = getManifestHints(dependencyInfo);
		if (manifestHints) {
			result.manifestHints = manifestHints;
		}
		return result;
	});
	artifactInfos.forEach((artifactInfo) => {
		artifactInfo.getEmbeds().forEach((embeddedArtifactInfo) => {
			const componentObject = {
				library: embeddedArtifactInfo.getParentComponentName()
			};
			const componentName = embeddedArtifactInfo.componentName;
			const dependencyInfo = dependencyInfoMap.get(componentName);
			const manifestHints = getManifestHints(dependencyInfo);
			if (manifestHints) {
				componentObject.manifestHints = manifestHints;
			}
			const bundledComponents = embeddedArtifactInfo.getParentBundledComponents();
			if (bundledComponents.has(componentName)) {
				componentObject.hasOwnPreload = true;
			}
			components[componentName] = componentObject;
		});
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
