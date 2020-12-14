const test = require("ava");
const sinon = require("sinon");

const processor = require("../../../lib/processors/libraryLessGenerator");
const {LibraryLessGenerator} = processor;

const FILE_HEADER = `/* NOTE: This file was generated as an optimized version of ` +
	`"library.source.less" for the Theme Designer. */`;

test.afterEach(() => {
	sinon.restore();
});

test.serial("processor: Creates LibraryLessGenerator and calls it for every resource", async (t) => {
	const resources = [
		{
			getPath() {
				return "/foo/library.source.less";
			},
			getString() {
				return "// Content of /foo/library.source.less";
			}
		},
		{
			getPath() {
				return "/bar/library.source.less";
			},
			getString() {
				return "// Content of /bar/library.source.less";
			}
		}
	];
	const fs = {readFile: sinon.stub()};

	const outputResources = await processor({
		resources, fs
	});

	t.is(resources.length, outputResources.length, "Processor returns same amount of resources");
	t.is(outputResources[0].getPath(), "/foo/library.less", "Processor returns new library.less resource");
	t.is(await outputResources[0].getString(),
		`/* NOTE: This file was generated as an optimized version ` +
		`of "library.source.less" for the Theme Designer. */\n\n` +
		`// Content of /foo/library.source.less`,
		"Processor returns new library.less resource");
	t.is(outputResources[1].getPath(), "/bar/library.less", "Processor returns new library.less resource");
	t.is(await outputResources[1].getString(),
		`/* NOTE: This file was generated as an optimized version ` +
			`of "library.source.less" for the Theme Designer. */\n\n` +
			`// Content of /bar/library.source.less`,
		"Processor returns new library.less resource");
});

test.serial("LibraryLessGenerator: File without imports", async (t) => {
	const input = `.rule {}`;
	const expectedOutput = `${FILE_HEADER}\n\n.rule {}`;

	const fs = {readFile: sinon.stub()};

	const output = await (new LibraryLessGenerator({fs})).generate({
		filePath: "/resources/sap/foo/themes/base/library.source.less",
		fileContent: input
	});

	t.is(output, expectedOutput);
});

test.serial("LibraryLessGenerator: File with normal import", async (t) => {
	const input = `@import "Foo.less";`;
	const expectedOutput = `${FILE_HEADER}\n\n` +
	`/* START "Foo.less" */\n` +
	`// Content of foo.less\n` +
	`/* END "Foo.less" */\n`;

	const fs = {
		readFile: sinon.stub().callsFake((filePath, options, cb) => {
			switch (filePath) {
			case "/resources/sap/foo/themes/base/Foo.less":
				cb(null, `// Content of foo.less\n`);
				return;
			default:
				cb(new Error("File not found: " + filePath));
				return;
			}
		})
	};

	const output = await (new LibraryLessGenerator({fs})).generate({
		filePath: "/resources/sap/foo/themes/base/library.source.less",
		fileContent: input
	});

	t.is(output, expectedOutput);
});

test.serial("LibraryLessGenerator: File with multiple imports", async (t) => {
	const input = `
@import "File1.less";
@import "File2.less";
@import "File3.less";
@import "File4.less";
@import "File5.less";
`;
	const expectedOutput = `${FILE_HEADER}


/* START "File1.less" */
// Content of /resources/sap/foo/themes/base/File1.less
/* END "File1.less" */

/* START "File2.less" */
// Content of /resources/sap/foo/themes/base/File2.less
/* END "File2.less" */

/* START "File3.less" */
// Content of /resources/sap/foo/themes/base/File3.less
/* END "File3.less" */

/* START "File4.less" */
// Content of /resources/sap/foo/themes/base/File4.less
/* END "File4.less" */

/* START "File5.less" */
// Content of /resources/sap/foo/themes/base/File5.less
/* END "File5.less" */

`;

	const fs = {
		readFile: sinon.stub().callsFake((filePath, options, cb) => {
			cb(null, `// Content of ${filePath}\n`);
		})
	};

	const output = await (new LibraryLessGenerator({fs})).generate({
		filePath: "/resources/sap/foo/themes/base/library.source.less",
		fileContent: input
	});

	t.is(output, expectedOutput);
});

test.serial("LibraryLessGenerator: File with nested imports", async (t) => {
	const input = `// Content of input\n` +
	`@import "Foo.less";`;
	const expectedOutput = `${FILE_HEADER}\n\n` +
	`// Content of input\n` +
	`/* START "Foo.less" */\n` +
	`// Content of Foo.less\n` +
	`/* START "Bar.less" */\n` +
	`// Content of Bar.less\n` +
	`/* END "Bar.less" */\n` +
	`/* END "Foo.less" */\n`;

	const fs = {
		readFile: sinon.stub().callsFake((filePath, options, cb) => {
			switch (filePath) {
			case "/resources/sap/foo/themes/base/Foo.less":
				cb(null, `// Content of Foo.less\n` +
				`@import "Bar.less";`
				);
				return;
			case "/resources/sap/foo/themes/base/Bar.less":
				cb(null, `// Content of Bar.less\n`);
				return;
			default:
				cb(new Error("File not found: " + filePath));
				return;
			}
		})
	};

	const output = await (new LibraryLessGenerator({fs})).generate({
		filePath: "/resources/sap/foo/themes/base/library.source.less",
		fileContent: input
	});

	t.is(output, expectedOutput);
});

test.serial("LibraryLessGenerator: No rewrite for sap.ui.core global.less/css", async (t) => {
	const input = `@import "global.less";\n` +
		`@import (less) "global.css";`;
	const expectedOutput = `${FILE_HEADER}\n\n` +
	`@import "global.less";\n` +
	`@import (less) "global.css";`;

	const fs = {
		readFile: sinon.stub().callsFake((filePath, options, cb) => {
			cb(new Error("File not found: " + filePath));
		})
	};

	const output = await (new LibraryLessGenerator({fs})).generate({
		filePath: "/resources/sap/ui/core/themes/base/library.source.less",
		fileContent: input
	});

	t.is(output, expectedOutput);
	t.is(fs.readFile.callCount, 0, "fs.readFile should not be called");
});

test.serial("LibraryLessGenerator: Rewrite for sap.ui.core base.less", async (t) => {
	const input = `@import "../base/base.less";\n` +
		`@import "base.less";`;
	const expectedOutput = `${FILE_HEADER}\n\n` +
	`@import "../../../../../../Base/baseLib/baseTheme/base.less"; ` +
		`/* ORIGINAL IMPORT PATH: "../base/base.less" */\n\n` +
	`@import "../../../../../../Base/baseLib/sap_fiori_3/base.less"; ` +
		`/* ORIGINAL IMPORT PATH: "base.less" */\n`;

	const fs = {
		readFile: sinon.stub().callsFake((filePath, options, cb) => {
			cb(new Error("File not found: " + filePath));
		})
	};

	const output = await (new LibraryLessGenerator({fs})).generate({
		filePath: "/resources/sap/ui/core/themes/sap_fiori_3/library.source.less",
		fileContent: input
	});

	t.is(output, expectedOutput);
	t.is(fs.readFile.callCount, 0, "fs.readFile should not be called");
});

test.serial("LibraryLessGenerator: Rewrite for library.source.less", async (t) => {
	const input = `@import "../base/library.source.less";`;
	const expectedOutput = `${FILE_HEADER}\n\n` +
	`@import "../base/library.less";`;

	const fs = {
		readFile: sinon.stub().callsFake((filePath, options, cb) => {
			cb(new Error("File not found: " + filePath));
		})
	};

	const output = await (new LibraryLessGenerator({fs})).generate({
		filePath: "/resources/sap/ui/core/themes/sap_fiori_3/library.source.less",
		fileContent: input
	});

	t.is(output, expectedOutput);
	t.is(fs.readFile.callCount, 0, "fs.readFile should not be called");
});

test.serial("LibraryLessGenerator: No rewrite for file in sub-folder", async (t) => {
	const input = `@import "foo/bar.less";`;
	const expectedOutput = `${FILE_HEADER}\n\n` +
	`@import "foo/bar.less";`;

	const fs = {
		readFile: sinon.stub().callsFake((filePath, options, cb) => {
			cb(new Error("File not found: " + filePath));
		})
	};

	const output = await (new LibraryLessGenerator({fs})).generate({
		filePath: "/resources/sap/ui/core/themes/sap_fiori_3/library.source.less",
		fileContent: input
	});

	t.is(output, expectedOutput);
	t.is(fs.readFile.callCount, 0, "fs.readFile should not be called");
});

test.serial("LibraryLessGenerator: No rewrite for file outside of theme folder", async (t) => {
	const input = `@import "../../foo.less";`;
	const expectedOutput = `${FILE_HEADER}\n\n` +
	`@import "../../foo.less";`;

	const fs = {
		readFile: sinon.stub().callsFake((filePath, options, cb) => {
			cb(new Error("File not found: " + filePath));
		})
	};

	const output = await (new LibraryLessGenerator({fs})).generate({
		filePath: "/resources/sap/ui/core/themes/sap_fiori_3/library.source.less",
		fileContent: input
	});

	t.is(output, expectedOutput);
	t.is(fs.readFile.callCount, 0, "fs.readFile should not be called");
});
