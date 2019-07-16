const stringEscaper = require("../processors/stringEscaper");

/**
 * Encodings
 *
 * @type {{UTF_8: string, ISO_8859_1: string}}
 */
const ENCODING_TYPES = {
	UTF_8: "UTF-8",
	ISO_8859_1: "ISO-8859-1"
};

/**
 * Task to escape non ascii characters in properties files resources.
 *
 * @public
 * @alias module:@ui5/builder.tasks.escapePropertiesFiles
 * @param {Object} parameters Parameters
 * @param {module:@ui5/fs.DuplexCollection} parameters.workspace DuplexCollection to read and write files
 * @param {Object} parameters.options Options
 * @param {string} parameters.options.pattern Pattern to locate the files to be processed
 * @param {string} [parameters.options.sourceEncoding] source file encoding: "UTF-8" or "ISO-8859-1". Defaults to "ISO-8859-1"
 * @returns {Promise<undefined>} Promise resolving with <code>undefined</code> once data has been written
 */
module.exports = function({workspace, options}) {
	if (options.sourceEncoding && !Object.values(ENCODING_TYPES).includes(options.sourceEncoding)) {
		return Promise.reject(new Error(`Invalid encoding specified: '${options.sourceEncoding}'. Must be one of ${Object.values(ENCODING_TYPES)}`));
	}
	if (options.sourceEncoding && options.sourceEncoding === ENCODING_TYPES.UTF_8) {
		return Promise.resolve();
	}
	return workspace.byGlob(options.pattern)
		.then((allResources) => {
			return stringEscaper({
				resources: allResources
			});
		})
		.then((processedResources) => {
			return Promise.all(processedResources.map((resource) => {
				return workspace.write(resource);
			}));
		});
};
