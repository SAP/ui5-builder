const log = require("@ui5/logger").getLogger("builder:tasks:transform");
const bootstrapHtmlTransformer = require("../processors/bootstrapHtmlTransformer");

/**
 * Task for bundling standalone applications.
 *
 * @module builder/tasks/transformBootstrapHtml
 * @param {Object} parameters Parameters
 * @param {DuplexCollection} parameters.workspace DuplexCollection to read and write files
 * @param {AbstractReader} parameters.dependencies Reader or Collection to read dependency files
 * @param {Object} parameters.options Options
 * @param {string} parameters.options.projectName Project name
 * @param {string} parameters.options.namespace Project namespace
 * @returns {Promise<undefined>} Promise resolving with <code>undefined</code> once data has been written
 */
module.exports = async function({workspace, options}) {
	const resource = await workspace.byPath(`/resources/${options.namespace}/index.html`);
	if (!resource) {
		log.warn(`Could not find index.html of project "${options.projectName}"`);
		return;
	}
	const processedResources = await bootstrapHtmlTransformer({
		resources: [resource],
		options: {
			src: "resources/sap-ui-custom.js"
		}
	});
	await Promise.all(processedResources.map((resource) => workspace.write(resource)));
};
