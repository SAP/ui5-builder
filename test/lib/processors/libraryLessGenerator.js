const test = require("ava");
const sinon = require("sinon");

const {LibraryLessGenerator} = require("../../../lib/processors/libraryLessGenerator");

const FILE_HEADER = `/* NOTE: This file was generated as an optimized version of ` +
	`"library.source.less" for the Theme Designer. */`;

test("LibraryLessGenerator: File without imports", async (t) => {
	const input = `.rule {}`;
	const expectedOutput = `${FILE_HEADER}\n\n.rule {}`;

	const librarySourceLessResource = {
		async getString() {
			return input;
		}
	};
	const fs = {readFile: sinon.stub()};

	const output = await (new LibraryLessGenerator({librarySourceLessResource, fs})).generate();

	t.is(output, expectedOutput);
});

test("LibraryLessGenerator: File with normal import", async (t) => {
	const input = `@import "Foo.less";`;
	const expectedOutput = `${FILE_HEADER}\n\n` +
	`/* START "Foo.less" */\n` +
	`// Content of foo.less\n` +
	`/* END "Foo.less" */\n`;

	const librarySourceLessResource = {
		async getString() {
			return input;
		}
	};
	const fs = {
		readFile: sinon.stub().callsFake((filePath, options, cb) => {
			switch (filePath) {
			case "Foo.less":
				cb(null, `// Content of foo.less\n`);
				return;
			default:
				cb(new Error("File not found: " + filePath));
				return;
			}
		})
	};

	const output = await (new LibraryLessGenerator({librarySourceLessResource, fs})).generate();

	t.is(output, expectedOutput);
});

test("LibraryLessGenerator: File with multiple imports", async (t) => {
	const input = `
@import "File1.less";
@import "File2.less";
@import "File3.less";
@import "File4.less";
@import "File5.less";
`;
	const expectedOutput = `${FILE_HEADER}


/* START "File1.less" */
// Content of File1.less
/* END "File1.less" */

/* START "File2.less" */
// Content of File2.less
/* END "File2.less" */

/* START "File3.less" */
// Content of File3.less
/* END "File3.less" */

/* START "File4.less" */
// Content of File4.less
/* END "File4.less" */

/* START "File5.less" */
// Content of File5.less
/* END "File5.less" */

`;

	const librarySourceLessResource = {
		async getString() {
			return input;
		}
	};
	const fs = {
		readFile: sinon.stub().callsFake((filePath, options, cb) => {
			cb(null, `// Content of ${filePath}\n`);
		})
	};

	const output = await (new LibraryLessGenerator({librarySourceLessResource, fs})).generate();

	t.is(output, expectedOutput);
});


test("LibraryLessGenerator: File with nested imports", async (t) => {
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

	const librarySourceLessResource = {
		async getString() {
			return input;
		}
	};
	const fs = {
		readFile: sinon.stub().callsFake((filePath, options, cb) => {
			switch (filePath) {
			case "Foo.less":
				cb(null, `// Content of Foo.less\n` +
				`@import "Bar.less";`
				);
				return;
			case "Bar.less":
				cb(null, `// Content of Bar.less\n`);
				return;
			default:
				cb(new Error("File not found: " + filePath));
				return;
			}
		})
	};

	const output = await (new LibraryLessGenerator({librarySourceLessResource, fs})).generate();

	t.is(output, expectedOutput);
});
