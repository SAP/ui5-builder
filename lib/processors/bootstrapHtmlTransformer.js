const log = require("@ui5/logger").getLogger("builder:processors:bootstrapHtmlTransformer");
const cheerio = require("cheerio");

/**
 * Transforms the UI5 bootstrap of a HTML resource files.
 *
 * @module builder/processors/bootstrapHtmlTransformer
 * @param {Object} parameters Parameters
 * @param {Resource[]} parameters.resources List of resources to be processed
 * @param {Object} [parameters.options] Options
 * @param {Object} [parameters.options.src] Bootstrap "src" that should be used
 * @returns {Promise<Resource[]>} Promise resolving with the cloned resources
 */
module.exports = function({resources, options}) {
	async function processResource(resource) {
		const content = await resource.getString();
		const $ = cheerio.load(content);
		const bootstrapScript = $("#sap-ui-bootstrap");
		if (bootstrapScript.length === 1) {
			bootstrapScript.attr("src", options.src);
			resource.setString($.html());
		} else if (bootstrapScript.length > 1) {
			log.warn("Found multiple bootstrap script tags with id=sap-ui-bootstrap");
		} else {
			log.warn("Could not find bootstrap script tag with id=sap-ui-bootstrap");
		}
		return resource;
	}

	return Promise.all(resources.map(processResource));
};
