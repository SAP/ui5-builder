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
const copyrightCommentsAndBundleCommentPattern =
	/copyright|\(c\)(?:[0-9]+|\s+[0-9A-za-z])|released under|license|\u00a9|^@ui5-bundle-raw-include |^@ui5-bundle /i;

async function uglify({filePath, code}) {
	try {
		const result = await terser.minify({
			[filePath]: code
		}, {
			output: {
				comments: copyrightCommentsAndBundleCommentPattern,
				wrap_func_args: false
			},
			compress: false
		});
		return result.code;
	} catch (error) {
		throw new Error(
			`Uglification failed with error: ${error.message} in file ${error.filename} ` +
			`(line ${error.line}, col ${error.col}, pos ${error.pos})`);
	}
}

if (!workerpool.isMainThread) {
	// create a worker and register public functions
	workerpool.worker({
		uglify
	});
} else {
	// Normal use without worker
	module.exports = uglify;
}


