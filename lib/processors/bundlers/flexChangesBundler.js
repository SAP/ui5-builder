const log = require("@ui5/logger").getLogger("builder:processors:bundlers:flexChangesBundler");
const resourceFactory = require("@ui5/fs").resourceFactory;

/**
 * Bundles all supplied changes.
 *
 * @public
 * @alias module:@ui5/builder.processors.flexChangesBundler
 * @param {Object} parameters Parameters
 * @param {module:@ui5/fs.Resource[]} parameters.resources List of resources to be processed
 * @param {Object} parameters.options Options
 * @param {string} parameters.options.pathPrefix Prefix for bundle path
 * @param {string} parameters.options.hasFlexBundleVersion true if minUI5Version >= 1.73 than create flexibility-bundle.json
 * @returns {Promise<module:@ui5/fs.Resource[]>} Promise resolving with flex changes bundle resources
 */
module.exports = function({resources, options}) {
	let bundleName = "changes-bundle.json";

	function sortByTimeStamp(a, b) {
		return a.creation > b.creation ? 1 : -1;
	}

	function sortAndStringifyInFlexFormat(changesContent) {
		changesContent = changesContent.sort(sortByTimeStamp);
		const changeList = [];
		const variantDependentControlChangeList = [];
		const compVariantList = [];
		const variantList = [];
		const variantChangeList = [];
		const variantManagementChangeList = [];

		changesContent.forEach(function(content) {
			switch (content.fileType) {
			case "change":
				if (content.appDescriptorChange && (content.appDescriptorChange === "true" || content.appDescriptorChange == true)) {
					break;
				}
				if (content.variantReference && content.variantReference !== "") {
					variantDependentControlChangeList.push(content);
				} else {
					changeList.push(content);
				}
				break;
			case "variant":
				compVariantList.push(content);
				break;
			case "ctrl_variant":
				variantList.push(content);
				break;
			case "ctrl_variant_change":
				variantChangeList.push(content);
				break;
			case "ctrl_variant_management_change":
				variantManagementChangeList.push(content);
				break;
			}
		});

		if (!options.hasFlexBundleVersion && (compVariantList.length != 0 || variantList.length != 0 || variantChangeList.length != 0 || variantDependentControlChangeList.length != 0 || variantManagementChangeList.length != 0)) {
			throw new Error("There are some control variant change in the changes folder. This only works with a minUI5Version 1.73.0. Please update the minUI5Version in the manifest.json minimum to 1.73.0");
		}
		// create changes-bundle.json
		if (!options.hasFlexBundleVersion) {
			return JSON.stringify(changeList);
		} else {
			bundleName = "flexibility-bundle.json";
			const newChangeFormat = {};
			newChangeFormat.changes = changeList;
			newChangeFormat.compVariants = compVariantList;
			newChangeFormat.variants = variantList;
			newChangeFormat.variantChanges = variantChangeList;
			newChangeFormat.variantDependentControlChanges = variantDependentControlChangeList;
			newChangeFormat.variantManagementChanges = variantManagementChangeList;

			return JSON.stringify(newChangeFormat);
		}
	}

	return Promise.all(resources.map((resource) => {
		return resource.getBuffer().then((buffer) => {
			return JSON.parse(buffer.toString());
		});
	})).then((changesContent) => {
		const nNumberOfChanges = changesContent.length;
		log.info("Changes collected. Number of changes: " + nNumberOfChanges);
		const result = [];
		if (nNumberOfChanges > 0) {
			changesContent = sortAndStringifyInFlexFormat(changesContent);
			result.push(resourceFactory.createResource({
				path: `${options.pathPrefix}/changes/` + bundleName,
				string: changesContent
			}));
		}
		return result;
	});
};
