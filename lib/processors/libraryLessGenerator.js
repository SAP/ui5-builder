// const log = require("@ui5/logger").getLogger("builder:processors:libraryLessGenerator");

const {promisify} = require("util");
const posixPath = require("path").posix;

const IMPORT_PATTERN = /@import .*"(.*)";/g;
const BASE_LESS_PATTERN = /^\/resources\/sap\/ui\/core\/themes\/([^/]+)\/base\.less$/;
const GLOBAL_LESS_PATTERN = /^\/resources\/sap\/ui\/core\/themes\/([^/]+)\/global\.(less|css)$/;

class LibraryLessGenerator {
	constructor({librarySourceLessResource, fs}) {
		this.librarySourceLessResource = librarySourceLessResource;
		const readFile = promisify(fs.readFile);
		this.readFile = async (filePath) => readFile(filePath, {encoding: "utf8"});
	}

	async generate() {
		let content = `/* NOTE: This file was generated as an optimized version of ` +
			`"library.source.less" for the Theme Designer. */\n\n`;

		content += await this.resolveLessImports({
			filePath: this.librarySourceLessResource.getPath(),
			fileContent: await this.librarySourceLessResource.getString()
		});

		return content;
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
		const resolvedImports = await Promise.all(imports.map((importMatch) => {
			const resolvedFilePath = posixPath.resolve(posixPath.dirname(filePath), importMatch.path);
			return this.resolveLessImport(importMatch, resolvedFilePath);
		}));
		const array = Array.from(fileContent);
		for (let i = resolvedImports.length - 1; i >= 0; i--) {
			const resolvedImport = resolvedImports[i];
			if (!resolvedImport) {
				continue;
			}
			array.splice(
				/* index   */ resolvedImport.matchStart,
				/* count   */ resolvedImport.matchLength,
				/* insert  */ resolvedImport.content
			);
		}
		return array.join("");
	}
	async resolveLessImport(importMatch, resolvedFilePath) {
		// Re-write base.less imports
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

		// Re-write library imports to correct file name
		if (importMatch.path.endsWith("library.source.less")) {
			importMatch.content =
				`@import "${importMatch.path.replace(/library\.source\.less$/, "library.less")}";`;
			return importMatch;
		}

		// No re-write for global.less/css
		if (GLOBAL_LESS_PATTERN.test(resolvedFilePath)) {
			return null;
		}

		// TODO: No re-write for files not within same folder as current file

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
module.exports = async function({
	resources,
	fs
}) {
	return Promise.all(resources.map((librarySourceLessResource) => {
		return new LibraryLessGenerator({librarySourceLessResource, fs}).generate();
	}));
};

// Export class for testing only
if (process.env.NODE_ENV === "test") {
	module.exports.LibraryLessGenerator = LibraryLessGenerator;
}
