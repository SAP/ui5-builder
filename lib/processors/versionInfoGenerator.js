const resourceFactory = require("@ui5/fs").resourceFactory;

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
 * @returns {Promise<DependencyInfos>}
 */
const processManifest = async (manifestResource) => {
	const manifestContent = await manifestResource.getString();
	const manifestObject = JSON.parse(manifestContent);
	// TODO extract manifestHints
	const manifestDependencies = manifestObject["sap.ui5"]["dependencies"];
	const result = {
		embeds: [],
		libs: {}
	};
	if (manifestDependencies) {
		Object.keys(manifestDependencies.libs).forEach((libKey) => {
			result.libs[libKey] = {};
			if (manifestDependencies.libs[libKey].lazy) {
				result.libs[libKey].lazy = true;
			}
		});
	}

	// there for components
	const manifestEmbeds = manifestObject["sap.app"]["embeds"];
	if (manifestEmbeds) {
		result.embeds = manifestEmbeds;
	}
	result.id = manifestObject["sap.app"]["id"];
	return result;
};

/**
 * Manifest Hint
 *
 * @public
 * @typedef {object} DependencyInfos
 * @property {object} libs The library object
 * @property {string[]} embeds embedded components
 * @property {string} id id
 *
 *
 * @example
 * {
 *  sap.chart: {
 *      lazy: true
 *  },
 *  sap.f: { },
 * }
 *
 */


/**
 * Library Info object
 *
 * @public
 * @typedef {object} LibraryInfo
 * @property {string} name The library name
 * @property {string} version The library version
 * @property {module:@ui5/fs.Resource} mainManifest main manifest resources
 * @property {module:@ui5/fs.Resource[]} manifestResources list of corresponding manifest resources
 */

const getManifestPath = (filePath, subPath) => {
	if (filePath.endsWith("manifest.json")) {
		return filePath.substr(0, filePath.length - "manifest.json".length) + subPath + "/manifest.json";
	}
	return filePath;
};

/**
 *
 * @param {Map<string, DependencyInfos>} manifestHints
 */
const resolveTransitiveDependencies = (manifestHints) => {
	// top level libraries
	//  // lib.a => lib.c, lib.b
	// 	// lib.b => lib.d
	// 	// lib.c => lib.e, lib.b (true)
	// 	// lib.d => lib.e (true)
	// 	// lib.e =>
	// TODO optimize duplicate resolve (e.g. cache)

	// lib.c => lib.e, lib.b (true), lib.d
	// lib.a => lib.c, lib.b, lib.d, lib.e
	// lib.b => lib.d, lib.e (true)
	// lib.d => lib.e (true)
	// lib.e =>
	const keys = [...manifestHints.keys()];
	keys.sort();
	const resolvedCache = new Map();
	keys.forEach((libName) => {
		resolve(libName, manifestHints, resolvedCache);
	});
};

const clone = (obj) => {
	return JSON.parse(JSON.stringify(obj));
};

/**
 *
 * @param {Map<string, DependencyInfos>} manifestHints
 * @param {string} libName
 * @param {object} newObject
 */
const setManifestHints = (manifestHints, libName, newObject) => {
	const existingEntry = manifestHints.get(libName);
	const newLibs = merge(existingEntry && existingEntry, newObject);
	console.log(`  setting ${libName} ==> ${Object.keys(newLibs).join(", ")}`);
	manifestHints.set(libName, newLibs);
};

const merge = (existingEntry, newObject) => {
	const newLibs = clone(newObject);
	if (existingEntry) {
		Object.keys(existingEntry).forEach((libName) => {
			if (!existingEntry[libName].lazy && newLibs[libName] && newLibs[libName].lazy) {
				newLibs[libName] = {};
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
 * @param {Map<string, DependencyInfos>} manifestHints
 * @param {Map<string, DependencyInfos>} resolvedCache
 * @returns {DependencyInfos} resolved dependencies
 */
const resolve = (libName, manifestHints, resolvedCache) => {
	// lib.c get entries
	// lib.c => lib.b (true)
	// lib.b =>
	if ( resolvedCache.has(libName)) {
		return resolvedCache.get(libName);
	}
	const manifestHint = manifestHints.get(libName); // lib.c
	console.log(`:processing: ${libName}`);
	const keys = Object.keys(manifestHint); // [lib.b]
	let resolved = {};
	keys.forEach((childLibName) => {
		const childResolved = resolve(childLibName, manifestHints, resolvedCache);
		resolved = merge(resolved, childResolved);
		console.log(`resolved ${childLibName} with ${Object.keys(resolved).join(", ")}`);
	});
	resolved = merge(resolved, manifestHint);
	setManifestHints(manifestHints, libName, resolved);
	resolvedCache.set(libName, resolved);
	return resolved;
};


const out = (libs) => {
	const res = Object.keys(libs).map((libName) => {
		if (libs[libName].lazy) {
			return libName + " (" + libs[libName].lazy + ")";
		}
		return libName;
	});
	return res;
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
 * @param {Array} parameters.options.libraryInfos Array of objects representing libraries,
 *					e.g. <code>{name: "library.xy", version: "1.0.0"}</code>
 * @returns {Promise<module:@ui5/fs.Resource[]>} Promise resolving with an array containing the versioninfo resource
 */

module.exports = async function({options}) {
	if (!options.rootProjectName || options.rootProjectVersion === undefined || options.libraryInfos === undefined) {
		throw new Error("[versionInfoGenerator]: Missing options parameters");
	}

	const buildTimestamp = getTimestamp();
	// TODO filter manifest.json if sap/embeds (we expect it contains the correct information)

	const components = {};
	/**
	 * @example
	 * "sap.ui.integration": {
	 *  sap.chart: {
	 *      lazy: true
	 *  },
	 *  sap.f: { },
	 * }
	 *
	 * @type {Map<string, DependencyInfos>}
	 */
	const dependencyInfoMap = new Map();
	const embeddedInfoMap = new Map();

	// gather all manifestHints
	const librariesPromises = options.libraryInfos.map((libraryInfo) => {
		// TODO use proper async await!
		return processManifest(libraryInfo.mainManifest).then((manifestHint) => {
			dependencyInfoMap.set(libraryInfo.name, manifestHint.libs);
			return manifestHint.embeds;
		}).then((embeds) => {
			// filter
			embeds.forEach((embed) => {
				embeddedInfoMap.set(embed, {
					library: libraryInfo.name
				});
			});
			const embeddedPaths = embeds.map((embed) => {
				return getManifestPath(libraryInfo.mainManifest.getPath(), embed);
			});
			const relevantManifests = libraryInfo.manifestResources.filter((manifestResource) => {
				return embeddedPaths.includes(manifestResource.getPath());
			});

			// get all embeds manifests
			return Promise.all(relevantManifests.map((relevantManifest) => {
				return processManifest(relevantManifest).then((result) => {
					dependencyInfoMap.set(result.id, result.libs);
				});
			}));
		});
	});

	// gather embeds' manifest and do the same

	await Promise.all(librariesPromises);

	console.log("before:");
	dependencyInfoMap.forEach((manifestHint, key) => {
		console.log(`${key} => ${out(manifestHint).join(", ")}`);
	});

	// resolve nested dependencies (transitive)
	resolveTransitiveDependencies(dependencyInfoMap);

	console.log("\nafter:");
	dependencyInfoMap.forEach((manifestHint, key) => {
		console.log(`${key} => ${out(manifestHint).join(", ")}`);
	});


	const libraries = options.libraryInfos.map((libraryInfo) => {
		const result = {
			name: libraryInfo.name,
			version: libraryInfo.version,
			buildTimestamp: buildTimestamp,
			scmRevision: ""// TODO: insert current library scm revision here
		};

		const libs = dependencyInfoMap.get(libraryInfo.name);
		// TODO: sort the libs
		if (Object.keys(libs).length) {
			result.manifestHints = {
				dependencies: {
					libs: libs
				}
			};
		}
		return result;
	});

	// TODO sort!
	embeddedInfoMap.forEach((embeddedInfo, libName) => {
		components[libName] = {
			library: embeddedInfo.library
		};
		const libs = dependencyInfoMap.get(libName);
		if (libs && Object.keys(libs).length) {
			components[libName].manifestHints = {
				dependencies: {
					libs: libs
				}
			};
		}
	});

	// sort alphabetically
	libraries.sort((a, b) => {
		return a.name.localeCompare(b.name);
	});


	// TODO enrich components

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
