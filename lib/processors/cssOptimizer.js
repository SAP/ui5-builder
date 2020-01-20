const CleanCSS = require("clean-css");
const log = require("@ui5/logger").getLogger("builder:processors:cssOptimizer");

/**
 * Optimizes the supplied CSS resources.
 *
 * @public
 * @alias module:@ui5/builder.processors.cssOptimizer
 * @param {Object} parameters Parameters
 * @param {module:@ui5/fs.Resource[]} parameters.resources List of resources to be processed
 * @returns {Promise<module:@ui5/fs.Resource[]>} Promise resolving with optimized resources
 */
module.exports = function({resources}) {
	// use clean-css default options
	const options = {
		returnPromise: true
	};
	const cleanCSSInstance = new CleanCSS(options);
	return Promise.all(resources.map((resource) => {
		return resource.getString().then((css) => {
			return cleanCSSInstance.minify(css).then((result) => {
				if (Array.isArray(result.warnings) && result.warnings.length) {
					log.warn(`Warnings occurred: ${result.warnings.join(", ")}`);
				}
				resource.setString(result.styles);
				return resource;
			}, (error) => {
				throw new Error(`Errors occurred: ${error.join(", ")}`);
			});
		});
	}));
};
