const path = require("path");
const terser = require("terser");
const util = require("util");
const Resource = require("@ui5/fs").Resource;
const duplicator = require("./resourceCopier");

/**
 * Preserve comments which contain:
 * <ul>
 *  <li>copyright notice</li>
 *  <li>license terms</li>
 *  <li>"@ui5-bundle"</li>
 *  <li>"@ui5-bundle-raw-include"</li>
 * </ul>
 *
 * @type {RegExp}
 */
const copyrightCommentsAndBundleCommentPattern = /copyright|\(c\)(?:[0-9]+|\s+[0-9A-za-z])|released under|license|\u00a9|^@ui5-bundle-raw-include |^@ui5-bundle /i;
const debugFileRegex = /((?:\.view|\.fragment|\.controller|\.designtime|\.support)?\.js)$/;

/**
 * Minifies the supplied resources.
 *
 * @public
 * @alias module:@ui5/builder.processors.uglifier
 * @param {object} parameters Parameters
 * @param {module:@ui5/fs.Resource[]} parameters.resources List of resources to be processed
 * @param {fs|module:@ui5/fs.fsInterface} parameters.fs Node fs or
 *   custom [fs interface]{@link module:resources/module:@ui5/fs.fsInterface}
 * @returns {Promise<object>} Promise resolving with object of resource, dbgResource and sourceMap
 */
module.exports = async function({resources, fs}) {
	const stat = util.promisify(fs.stat);

	return Promise.all(resources.map(async (resource) => {
		const dbgPath = resource.getPath().replace(debugFileRegex, "-dbg$1");

		// Check whether the debug resource path is already used and log an error since we don't really expect this
		// to happen anymore (this used to happen when bundle creation was done before debug-file creation)
		try {
			await stat(dbgPath);

			// if the file can be found something might be off or we should just skip it
			throw new Error(
				`TODO 3.0: Unexpected dbg-variant for resource ${resource.getPath()} already present in workspace`);
		} catch (err) {
			if (err.code !== "ENOENT") {
				// if it's another error, forward it
				throw err;
			}
			// if the file can't be found, we can continue
		}

		const dbgResource = await resource.clone();
		dbgResource.setPath(dbgPath);

		const code = await resource.getString();
		try {
			const filename = path.posix.basename(resource.getPath());
			const result = await terser.minify({
				[dbgPath]: code
			}, {
				output: {
					comments: copyrightCommentsAndBundleCommentPattern,
					wrap_func_args: false
				},
				compress: false,
				mangle: {
					reserved: [
						"jQuery",
						"jquery",
					]
				},
				sourceMap: {
					filename,
					url: resource.getPath() + ".map"
				}
			});
			resource.setString(result.code);
			const sourceMap = new Resource({
				path: resource.getPath() + ".map",
				string: result.map
			});
			return {resource, dbgResource, sourceMap};
		} catch (err) {
			throw new Error(
				`Minification failed with error: ${err.message} in file ${err.filename} ` +
				`(line ${err.line}, col ${err.col}, pos ${err.pos})`);
		}
	}));
};
