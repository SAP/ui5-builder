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
	return result;
};

/**
 * Manifest Hint
 *
 * @public
 * @typedef {object} DependencyInfos
 * @property {object} libs The library object
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


/**
 *
 * @param {Map<string, DependencyInfos>} manifestHints
 */
const resolveTransitiveDependencies = (manifestHints) => {
	manifestHints.forEach((manifestHint, key) => {
		const resolvedLibs = {};
		Object.keys(manifestHint.libs).forEach((libName) => {
			resolvedLibs[libName] = manifestHint.libs[libName];
			const resolved = resolve(libName, manifestHints, resolvedLibs);
			Object.keys(resolved).forEach((nestedKey) => {
				manifestHint.libs[nestedKey] = resolved[nestedKey];
			});
		});
	});
};

const isLazy = (obj1, obj2) => {
	return obj1.lazy && obj2.lazy;
};

/**
 *
 * @param {string} libName
 * @param {Map<string, DependencyInfos>} manifestHints
 * @param {object} resolvedLibs
 */
const resolve = (libName, manifestHints, resolvedLibs) => {
	const manifestHint = manifestHints.get(libName);
	Object.keys(manifestHint.libs).forEach((childLibName) => {
		if (resolvedLibs[childLibName] && !isLazy(manifestHint.libs[childLibName], resolvedLibs[childLibName])) {
			resolvedLibs[childLibName] = {};
		} else {
			resolvedLibs[childLibName] = manifestHint.libs[childLibName];
		}

		const nested = resolve(childLibName, manifestHints, resolvedLibs);
		Object.keys(nested).forEach((nestedKey) => {
			resolvedLibs[nestedKey] = resolvedLibs[nestedKey] || {};
		});
	});

	return resolvedLibs;
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

	const components = [];
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

	// gather all manifestHints
	const librariesPromises = options.libraryInfos.map((libraryInfo) => {
		return processManifest(libraryInfo.mainManifest).then((manifestHint) => {
			dependencyInfoMap.set(libraryInfo.name, manifestHint);
		});
	});

	await Promise.all(librariesPromises);

	console.log("before:");
	dependencyInfoMap.forEach((manifestHint, key) => {
		console.log(`${key} => ${out(manifestHint.libs).join(", ")}`);
	});

	// resolve nested dependencies (transitive)
	resolveTransitiveDependencies(dependencyInfoMap);

	console.log("\nafter:");
	dependencyInfoMap.forEach((manifestHint, key) => {
		console.log(`${key} => ${out(manifestHint.libs).join(", ")}`);
	});


	const libraries = options.libraryInfos.map((libraryInfo) => {
		const result = {
			name: libraryInfo.name,
			version: libraryInfo.version,
			buildTimestamp: buildTimestamp,
			scmRevision: ""// TODO: insert current library scm revision here
		};

		const libs = dependencyInfoMap.get(libraryInfo.name).libs;
		if (Object.keys(libs).length) {
			result.manifestHints = {
				dependencies: {
					libs: libs
				}
			};
		}
		return result;
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
