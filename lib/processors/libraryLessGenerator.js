// const log = require("@ui5/logger").getLogger("builder:processors:libraryLessGenerator");

const {promisify} = require("util");
const posixPath = require("path").posix;
const Resource = require("@ui5/fs").Resource;

const IMPORT_PATTERN = /@import .*"(.*)";/g;
const BASE_LESS_PATTERN = /^\/resources\/sap\/ui\/core\/themes\/([^/]+)\/base\.less$/;
const GLOBAL_LESS_PATTERN = /^\/resources\/sap\/ui\/core\/themes\/([^/]+)\/global\.(less|css)$/;

class LibraryLessGenerator {
	constructor({fs}) {
		const readFile = promisify(fs.readFile);
		this.readFile = async (filePath) => readFile(filePath, {encoding: "utf8"});
	}

	async generate({filePath, fileContent}) {
		return `/* NOTE: This file was generated as an optimized version of ` +
			`"library.source.less" for the Theme Designer. */\n\n` +
			await this.resolveLessImports({
				filePath,
				fileContent
			});
	}
	getPathToRoot(filePath) {
		return posixPath.relative(posixPath.dirname(filePath), "/");
	}
	async resolveLessImports({filePath, fileContent}) {
		const imports = this.findLessImports(fileContent);
		if (!imports.length) {
			// Skip processing when no imports are found
			return fileContent;
		}
		const replacements = await Promise.all(imports.map((importMatch) => {
			const baseDir = posixPath.dirname(filePath);
			const resolvedFilePath = posixPath.resolve(baseDir, importMatch.path);
			return this.resolveLessImport(importMatch, resolvedFilePath, baseDir);
		}));

		// Apply replacements in reverse order to not modify the relevant indices
		const array = Array.from(fileContent);
		for (let i = replacements.length - 1; i >= 0; i--) {
			const replacement = replacements[i];
			if (!replacement) {
				continue;
			}
			array.splice(
				/* index   */ replacement.matchStart,
				/* count   */ replacement.matchLength,
				/* insert  */ replacement.content
			);
		}
		return array.join("");
	}
	async resolveLessImport(importMatch, resolvedFilePath, baseDir) {
		// Rewrite base.less imports
		const baseLessMatch = BASE_LESS_PATTERN.exec(resolvedFilePath);
		if (baseLessMatch) {
			let baseLessThemeName = baseLessMatch[1];
			if (baseLessThemeName === "base") {
				baseLessThemeName = "baseTheme";
			}
			const baseLessPath = this.getPathToRoot(resolvedFilePath) +
				"/Base/baseLib/" + baseLessThemeName + "/base.less";
			importMatch.content =
				"@import \"" + baseLessPath + "\"; /* ORIGINAL IMPORT PATH: \"" + importMatch.path + "\" */\n";
			return importMatch;
		}

		// Rewrite library imports to correct file name
		if (importMatch.path.endsWith("library.source.less")) {
			importMatch.content =
				`@import "${importMatch.path.replace(/library\.source\.less$/, "library.less")}";`;
			return importMatch;
		}

		// No rewrite for global.less/css
		if (GLOBAL_LESS_PATTERN.test(resolvedFilePath)) {
			return null;
		}

		// No rewrite for files not within same folder as current file
		const relativeFilePath = posixPath.relative(baseDir, resolvedFilePath);
		if (relativeFilePath.includes(posixPath.sep)) {
			return null;
		}

		const importedFileContent = await this.readFile(resolvedFilePath);
		importMatch.content =
				`/* START "${importMatch.path}" */\n` +
				await this.resolveLessImports({
					filePath: resolvedFilePath,
					fileContent: importedFileContent
				}) +
				`/* END "${importMatch.path}" */\n`;

		return importMatch;
	}
	findLessImports(fileContent) {
		const imports = [];
		let match;
		while ((match = IMPORT_PATTERN.exec(fileContent)) !== null) {
			imports.push({
				path: match[1],
				matchStart: match.index,
				matchLength: match[0].length
			});
		}
		return imports;
	}
}

/**
 * Creates a library.less file for the SAP Theme Designer based on a library.source.less file.
 *
 * @public
 * @alias module:@ui5/builder.processors.libraryLessGenerator
 * @param {object} parameters Parameters
 * @param {module:@ui5/fs.Resource[]} parameters.resources List of <code>library.source.less</code>
 * resources
 * @param {fs|module:@ui5/fs.fsInterface} parameters.fs Node fs or custom
 * [fs interface]{@link module:resources/module:@ui5/fs.fsInterface}
 * @returns {Promise<module:@ui5/fs.Resource[]>} Promise resolving with library.less resources
 */
module.exports = async function({resources, fs}) {
	const generator = new LibraryLessGenerator({fs});
	return Promise.all(resources.map(async (librarySourceLessResource) => {
		const filePath = librarySourceLessResource.getPath();
		const fileContent = await librarySourceLessResource.getString();

		const libraryLessFileContent = await generator.generate({filePath, fileContent});
		const libraryLessFilePath = posixPath.join(posixPath.dirname(filePath), "library.less");

		return new Resource({
			path: libraryLessFilePath,
			string: libraryLessFileContent
		});
	}));
};

// Export class for testing only
/* istanbul ignore else */
if (process.env.NODE_ENV === "test") {
	module.exports.LibraryLessGenerator = LibraryLessGenerator;
}
