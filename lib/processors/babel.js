const babel = require("@babel/core");
const path = require("path");
const fs = require("fs");
/**
 * Transforms the supplied resources via babel.
 *
 * @public
 * @alias module:@ui5/builder.processors.babel
 * @param {Object} parameters Parameters
 * @param {module:@ui5/fs.Resource[]} parameters.resources List of resources to be processed
 * @returns {Promise<module:@ui5/fs.Resource[]>} Promise resolving with transformed resources
 */
module.exports = function({resources}) {
	const config = path.join(process.cwd(), ".babelrc");
	const configExists = fs.existsSync(config);

	return Promise.all(
		resources.map((resource) => {
			return resource.getString().then((code) => {
				let result;
				if (configExists) {
					result = babel.transformSync(code, {filename: "code.js"});
				} else {
					result = babel.transformSync(code, {presets: [require("@babel/preset-env")]});
				}

				resource.setString(result.code);
				return resource;
			});
		})
	);
};
