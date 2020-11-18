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
 * @returns {Promise<void>}
 */
const processManifest = async (manifestResource) => {
	const manifestContent = await manifestResource.getString();
	const manifestObject = JSON.parse(manifestContent);
	// TODO extract manifestHints
	return manifestObject;
};

/**
 * Library Info object
 *
 * @public
 * @typedef {object} LibraryInfo
 * @property {string} name The library name
 * @property {string} version The library version
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
 * @param {Array} parameters.options.libraryInfos Array of objects representing libraries,
 *					e.g. <code>{name: "library.xy", version: "1.0.0"}</code>
 * @returns {Promise<module:@ui5/fs.Resource[]>} Promise resolving with an array containing the versioninfo resource
 */

module.exports = async function({options}) {
	if (!options.rootProjectName || options.rootProjectVersion === undefined || options.libraryInfos === undefined) {
		throw new Error("[versionInfoGenerator]: Missing options parameters");
	}

	const components = [];
	const librariesPromises = options.libraryInfos.map(function(libraryInfo) {
		const manifestHintsPromise = libraryInfo.manifestResources.map((manifestResource) => {
			return processManifest(manifestResource);
		});

		return Promise.all(manifestHintsPromise).then((manifestHintsArray) => {
			// TODO from manifestHintsArray to manifestHintsObject
			const manifestHintsObject = {

			};
			return {
				name: libraryInfo.name,
				version: libraryInfo.version,
				buildTimestamp: buildTimestamp,
				scmRevision: "", // TODO: insert current library scm revision here
				manifestHints: manifestHintsObject
			};
		});
	});

	// TODO enrich components

	const libraries = await Promise.all(librariesPromises);

	const buildTimestamp = getTimestamp();
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
