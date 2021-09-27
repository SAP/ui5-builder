const stringReplacer = require("../processors/stringReplacer");

/**
 * Task to replace the buildtime <code>${buildtime}</code>.
 *
 * @public
 * @alias module:@ui5/builder.tasks.replaceBuildtime
 * @param {object} parameters Parameters
 * @param {module:@ui5/fs.DuplexCollection} parameters.workspace DuplexCollection to read and write files
 * @param {object} parameters.options Options
 * @param {string} parameters.options.pattern Pattern to locate the files to be processed
 * @returns {Promise<undefined>} Promise resolving with <code>undefined</code> once data has been written
 */
module.exports = function({workspace, options: {pattern}}) {
	const dateISO = new Date().toISOString();
	// expected format: 20210907-1124
	let dateFormatted = dateISO.replace(/(?:-|:)/g, "").replace("T", "-");
	dateFormatted = dateFormatted.slice(0, dateFormatted.indexOf("-") + 5);

	return workspace.byGlob(pattern)
		.then((processedResources) => {
			return stringReplacer({
				resources: processedResources,
				options: {
					pattern: "${buildtime}",
					replacement: dateFormatted
				}
			});
		})
		.then((processedResources) => {
			return Promise.all(processedResources.map((resource) => {
				return workspace.write(resource);
			}));
		});
};
