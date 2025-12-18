const stringReplacer = require("../processors/stringReplacer");

function pad(v) {
	return String(v).padStart(2, "0");
}
function getTimestamp() {
	const date = new Date();
	const year = date.getUTCFullYear();
	const month = pad(date.getUTCMonth() + 1);
	const day = pad(date.getUTCDate());
	const hours = pad(date.getUTCHours());
	const minutes = pad(date.getUTCMinutes());
	const seconds = pad(date.getUTCSeconds());
	// yyyy-MM-dd'T'HH:mm:ss'Z'
	return year + "-" + month + "-" + day + "T" + hours + ":" + minutes + ":" + seconds + "Z";
}

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
	const timestamp = getTimestamp();

	return workspace.byGlob(pattern)
		.then((processedResources) => {
			return stringReplacer({
				resources: processedResources,
				options: {
					pattern: "${buildtime}",
					replacement: timestamp
				}
			});
		})
		.then((processedResources) => {
			return Promise.all(processedResources.map((resource) => {
				return workspace.write(resource);
			}));
		});
};
