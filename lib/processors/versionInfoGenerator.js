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

/**
 * Manifest libraries as defined in the manifest.json file
 *
 * @typedef {object<string, object>} ManifestLibraries
 *
 * @example
 * {
 *   sap.chart: {
 *       lazy: true
 *   },
 *   sap.f: { }
 * }
 */

/**
 * Extracted information from a manifest's <code>sap.app</code> and <code>sap.ui5</code> sections.
 *
 * @typedef {object} ManifestInfo
 *
 * @property {string} id The library name
 * @property {string} embeddedBy the library this component is embedded in
 * @property {string[]} embeds the embedded component names
 * @property {ManifestLibraries} libs the dependencies
 */


/**
 * Processes manifest resource and extracts information.
 *
 * @param {module:@ui5/fs.Resource} manifestResource
 * @returns {Promise<ManifestInfo>}
 */
const processManifest = async (manifestResource) => {
	const manifestContent = await manifestResource.getString();
	const manifestObject = JSON.parse(manifestContent);
	const manifestInfo = {};

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
			manifestInfo.libs = libs;
		}
	}

	// sap.app/embeds, sap.app/embeddedBy and sap.app/id is used for "components"
	if (manifestObject["sap.app"]) {
		const manifestEmbeds = manifestObject["sap.app"]["embeds"];
		manifestInfo.embeds = manifestEmbeds;

		const manifestEmbeddedBy = manifestObject["sap.app"]["embeddedBy"];
		manifestInfo.embeddedBy = manifestEmbeddedBy;

		const id = manifestObject["sap.app"]["id"];
		manifestInfo.id = id;
	}
	return manifestInfo;
};

/**
 *
 * @param {string} embeddedBy e.g. "../"
 * @param {string} componentPath e.g. "sap/x/sub"
 * @param {string} libraryPathPrefix e.g. "sap/x"
 * @returns {boolean} whether or not this component is bundled with the library
 */
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
 * Retrieves the manifest path
 *
 * @param {string} filePath path to the manifest, e.g. "sap/x/manifest.json"
 * @param {string} subPath relative sub path, e.g. "sdk"
 * @returns {string} manifest path, e.g. "sap/x/sdk/manifest.json"
 */
const getManifestPath = (filePath, subPath) => {
	const folderPathOfManifest = filePath.substr(0, filePath.length - "manifest.json".length) + subPath;
	return posixPath.resolve(folderPathOfManifest + "/manifest.json");
};

class DependencyInfoObject {
	/**
	 *
	 * @param {string} name name of the dependency, e.g. "sap.x"
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
		let alreadyResolved = this.isResolved(libName);
		if (!alreadyResolved) {
			alreadyResolved = new DependencyInfoObject(libName, lazy);
			this.libsResolved.push(alreadyResolved);
		} else {
			if (!alreadyResolved.lazy || !lazy) {
				alreadyResolved.lazy = undefined;
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
			this.libs.forEach((depInfoObject) => {
				const dependencyInfoObjectAdded = this.addResolvedLibDependency(depInfoObject.name, depInfoObject.lazy);
				const dependencyInfo = dependencyInfoMap.get(depInfoObject.name);
				if (dependencyInfo) {
					dependencyInfo.resolve(dependencyInfoMap, dependencyInfoObjectAdded.lazy);

					dependencyInfo.libsResolved.forEach((resolvedLib) => {
						this.addResolvedLibDependency(resolvedLib.name,
							resolvedLib.lazy || dependencyInfoObjectAdded.lazy);
					});
				} else {
					log.error(`Cannot find dependency '${depInfoObject.name}' for '${this.name}'`);
				}
			});
			this.wasResolved = true;
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
		dependencyInfo.libsResolved.forEach((dependencyInfoObject) => {
			libsObject[dependencyInfoObject.name] = {};
			if (dependencyInfoObject.lazy) {
				libsObject[dependencyInfoObject.name].lazy = true;
			}
		});
		return {
			dependencies: {
				libs: sortObjectKeys(libsObject)
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
		this.artifactInfos = [];
		this.parentBundledComponents = new Set();
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
		return this.artifactInfos;
	}

	/**
	 *
	 * @param {ArtifactInfo} parent
	 * @private
	 */
	_setParent(parent) {
		this.parent = parent;
		this.parentBundledComponents = this.parent.bundledComponents;
		this.parentComponentName = this.parent.componentName;
	}
}

/**
 * Processes the library info and fills the maps <code>dependencyInfoMap</code> and <code>embeddedInfoMap</code>.
 *
 * @param {LibraryInfo} libraryInfo
 * @returns {Promise<ArtifactInfo|undefined>}
 */
const processLibraryInfo = async (libraryInfo) => {
	if (!libraryInfo.libraryManifest) {
		log.warn(
			`Cannot add meta information for library '${libraryInfo.name}'. The manifest.json file cannot be found`);
		return;
	}

	const manifestInfo = await processManifest(libraryInfo.libraryManifest);
	// gather shallow library information
	const dependencyInfoObjects = convertToDependencyInfoObjects(manifestInfo.libs);

	const libraryArtifactInfo = new ArtifactInfo(libraryInfo.name);
	libraryArtifactInfo.setDependencyInfo(new DependencyInfo(dependencyInfoObjects, libraryInfo.name));

	const bundledComponents = new Set();
	libraryArtifactInfo.setBundledComponents(bundledComponents);

	const embeds = manifestInfo.embeds; // e.g. ["sdk"]
	// filter
	const embeddedPaths = embeds.map((embed) => {
		return getManifestPath(libraryInfo.libraryManifest.getPath(), embed);
	});
	// sap.x.sdk
	const relevantManifests = libraryInfo.manifestResources.filter((manifestResource) => {
		return embeddedPaths.includes(manifestResource.getPath());
	});

	// get all embedded manifests
	const embeddedManifestPromises = relevantManifests.map(async (relevantManifest) => {
		const fullManifestPath = posixPath.dirname(relevantManifest.getPath());
		const libraryPathPrefix = posixPath.dirname(libraryInfo.libraryManifest.getPath());

		const embeddedManifestInfo = await processManifest(relevantManifest);
		const dependencyInfoObjects = convertToDependencyInfoObjects(embeddedManifestInfo.libs);
		const componentName = embeddedManifestInfo.id;
		const componentArtifactInfo = new ArtifactInfo(componentName);
		componentArtifactInfo.setDependencyInfo(new DependencyInfo(dependencyInfoObjects, componentName));

		if (isBundledWithLibrary(embeddedManifestInfo.embeddedBy, fullManifestPath, libraryPathPrefix + "/")) {
			bundledComponents.add(componentName);
		}
		return componentArtifactInfo;
	});

	const embeddedArtifactInfos = await Promise.all(embeddedManifestPromises);
	libraryArtifactInfo.setEmbeds(embeddedArtifactInfos);

	return libraryArtifactInfo;
};

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

	let artifactInfos = await Promise.all(librariesPromises);
	artifactInfos = artifactInfos.filter(Boolean);

	// fill dependencyInfoMap
	artifactInfos.forEach((artifactInfo) => {
		dependencyInfoMap.set(artifactInfo.componentName, artifactInfo.dependencyInfo);
	});

	// resolve library dependencies (transitive)
	dependencyInfoMap.forEach((dependencyInfo) => {
		dependencyInfo.resolve(dependencyInfoMap);
	});

	// resolve dependencies of embedded components
	artifactInfos.forEach((artifactInfo) => {
		artifactInfo.getEmbeds().forEach((embeddedArtifactInfo) => {
			embeddedArtifactInfo.dependencyInfo.resolve(dependencyInfoMap);
		});
	});

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

	// sort libraries alphabetically
	libraries.sort((a, b) => {
		return a.name.localeCompare(b.name);
	});

	// components
	let components;
	artifactInfos.forEach((artifactInfo) => {
		artifactInfo.getEmbeds().forEach((embeddedArtifactInfo) => {
			const componentObject = {
				library: embeddedArtifactInfo.parentComponentName
			};
			const componentName = embeddedArtifactInfo.componentName;
			const dependencyInfo = embeddedArtifactInfo.dependencyInfo;
			const manifestHints = getManifestHints(dependencyInfo);
			if (manifestHints) {
				componentObject.manifestHints = manifestHints;
			}
			const bundledComponents = embeddedArtifactInfo.parentBundledComponents;
			if (bundledComponents.has(componentName)) {
				componentObject.hasOwnPreload = true;
			}
			components = components || {};
			components[componentName] = componentObject;
		});
	});

	// sort components alphabetically
	components = components && sortObjectKeys(components);

	const versionJson = {
		name: options.rootProjectName,
		version: options.rootProjectVersion, // TODO: insert current application version here
		buildTimestamp: buildTimestamp,
		scmRevision: "", // TODO: insert current application scm revision here
		// gav: "", // TODO: insert current application id + version here
		libraries,
		components
	};

	return [resourceFactory.createResource({
		path: "/resources/sap-ui-version.json",
		string: JSON.stringify(versionJson, null, "\t")
	})];
};
