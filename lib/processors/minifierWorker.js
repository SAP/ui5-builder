const workerpool = require("workerpool");
const terser = require("terser");

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

async function minify({
	filename,
	dbgFilename,
	code,
	sourceMapOptions
}) {
	try {
		return await terser.minify({
			// Use debug-name since this will be referenced in the source map "sources"
			[dbgFilename]: code
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
					"sap",
				]
			},
			sourceMap: sourceMapOptions
		});
	} catch (err) {
		// Note: err.filename contains the debug-name
		throw new Error(
			`Minification failed with error: ${err.message} in file ${filename} ` +
			`(line ${err.line}, col ${err.col}, pos ${err.pos})`);
	}
}

if (!workerpool.isMainThread) {
	// create a worker and register public functions
	workerpool.worker({
		minify
	});
} else {
	module.exports = minify;
}
