// const log = require("@ui5/logger").getLogger("builder:processors:libraryLessGenerator");

const {promisify} = require("util");

const IMPORT_PATTERN = /@import .*"(.*)";/g;

class LibraryLessGenerator {
	constructor({librarySourceLessResource, fs}) {
		this.librarySourceLessResource = librarySourceLessResource;
		const readFile = promisify(fs.readFile);
		this.readFile = async (filePath) => readFile(filePath, {encoding: "utf8"});
	}

	async generate() {
		let content = `/* NOTE: This file was generated as an optimized version of ` +
			`"library.source.less" for the Theme Designer. */\n\n`;

		const librarySourceLessContent = await this.librarySourceLessResource.getString();
		content += await this.resolveLessImports(librarySourceLessContent);

		return content;
	}
	async resolveLessImports(lessContent) {
		const imports = this.findLessImports(lessContent);
		if (!imports.length) {
			// Skip processing when no imports are found
			return lessContent;
		}
		const resolvedImports = await Promise.all(imports.map(async (importMatch) => {
			const importedFileContent = await this.readFile(importMatch.path);

			importMatch.content =
				`/* START "${importMatch.path}" */\n` +
				await this.resolveLessImports(importedFileContent) +
				`/* END "${importMatch.path}" */\n`;

			return importMatch;
		}));
		const array = Array.from(lessContent);
		for (let i = resolvedImports.length - 1; i >= 0; i--) {
			const resolvedImport = resolvedImports[i];
			array.splice(
				/* index   */ resolvedImport.matchStart,
				/* count   */ resolvedImport.matchLength,
				/* insert  */ resolvedImport.content
			);
		}
		return array.join("");
	}
	findLessImports(lessContent) {
		const imports = [];
		let match;
		while ((match = IMPORT_PATTERN.exec(lessContent)) !== null) {
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
