const stringEscaper = require("../processors/stringEscaper");

/**
 * Task to escape non ascii characters in properties files resources.
 *
 * @public
 * @alias module:@ui5/builder.tasks.escapePropertiesFiles
 * @param {Object} parameters Parameters
 * @param {module:@ui5/fs.DuplexCollection} parameters.workspace DuplexCollection to read and write files
 * @param {Object} parameters.options Options
 * @param {string} parameters.options.pattern Glob pattern to locate the files to be processed
 * @param {string} [parameters.options.encoding] source file encoding, e.g. "utf8", "latin1", ... (default is "utf8")
 * @returns {Promise<undefined>} Promise resolving with <code>undefined</code> once data has been written
 */
module.exports = async function({workspace, options}) {
	const allResources = await workspace.byGlob(options.pattern);

	const processedResources = await stringEscaper({
		resources: allResources,
		options: {
			encoding: options.encoding
		}
	});

	await Promise.all(processedResources.map((resource) => workspace.write(resource)));
};
