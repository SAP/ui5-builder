import test from "ava";
import sinon from "sinon";
import esmock from "esmock";

const FILE_HEADER = `/* NOTE: This file was generated as an optimized version of ` +
	`"library.source.less" for the Theme Designer. */`;

test.beforeEach(async (t) => {
	t.context.loggerStub = {
		error: sinon.stub(),
		verbose: sinon.stub()
	};

	t.context.processor = await esmock("../../../lib/processors/libraryLessGenerator.js", {
		"@ui5/logger": {
			getLogger: sinon.stub().withArgs("builder:processors:libraryLessGenerator").returns(t.context.loggerStub)
		}
	});
	t.context.LibraryLessGenerator = t.context.processor._LibraryLessGenerator;
});

test.afterEach.always(() => {
	sinon.restore();
});

test.serial("processor", async (t) => {
	const {processor, loggerStub} = t.context;

	const resources = [
		{
			getPath() {
				return "/resources/sap/foo/themes/base/library.source.less";
			},
			getString() {
				return `@import "../../../../sap/ui/core/themes/base/base.less";\n` +
				`@import "../../../../sap/ui/core/themes/base/global.less";\n` +
				`@import "Foo.less";`;
			}
		},
		{
			getPath() {
				return "/resources/sap/foo/themes/my_theme/library.source.less";
			},
			getString() {
				return `@import "../base/library.source.less";\n` +
				`@import "../../../../sap/ui/core/themes/my_theme/base.less";\n` +
				`@import "../../../../sap/ui/core/themes/my_theme/global.less";\n` +
				`@import "Foo.less";`;
			}
		}
	];
	const fs = {
		readFile: sinon.stub().callsFake((filePath, options, cb) => {
			switch (filePath) {
			case "/resources/sap/foo/themes/base/Foo.less":
				cb(null, `// Content of Foo.less\n` +
				`@import "Bar.less";`
				);
				return;
			case "/resources/sap/foo/themes/base/Bar.less":
				cb(null, `// Content of Bar.less`);
				return;
			case "/resources/sap/foo/themes/my_theme/Foo.less":
				cb(null, `// Content of Foo.less`);
				return;
			default:
				cb(new Error("File not found: " + filePath));
				return;
			}
		})
	};

	const outputResources = await processor({resources, fs});

	t.is(loggerStub.error.callCount, 0);
	t.is(resources.length, outputResources.length, "Processor returns same amount of resources");
	t.is(outputResources[0].getPath(), `/resources/sap/foo/themes/base/library.less`,
		"Processor returns new library.less resource");
	t.is(await outputResources[0].getString(),
		`/* NOTE: This file was generated as an optimized version of "library.source.less" for the Theme Designer. */

@import "../../../../../Base/baseLib/baseTheme/base.less"; \
/* ORIGINAL IMPORT PATH: "../../../../sap/ui/core/themes/base/base.less" */

@import "../../../../sap/ui/core/themes/base/global.less";
/* START "Foo.less" */
// Content of Foo.less
/* START "Bar.less" */
// Content of Bar.less
/* END "Bar.less" */

/* END "Foo.less" */
`,
		"Processor returns new library.less resource");
	t.is(outputResources[1].getPath(), `/resources/sap/foo/themes/my_theme/library.less`,
		"Processor returns new library.less resource");
	t.is(await outputResources[1].getString(),
		`/* NOTE: This file was generated as an optimized version of "library.source.less" for the Theme Designer. */

@import "../base/library.less";
@import "../../../../../Base/baseLib/my_theme/base.less"; \
/* ORIGINAL IMPORT PATH: "../../../../sap/ui/core/themes/my_theme/base.less" */

@import "../../../../sap/ui/core/themes/my_theme/global.less";
/* START "Foo.less" */
// Content of Foo.less
/* END "Foo.less" */
`,
		"Processor returns new library.less resource");
});

test.serial("LibraryLessGenerator: File without imports", async (t) => {
	const {LibraryLessGenerator, loggerStub} = t.context;

	const input = `.rule {}`;
	const expectedOutput = `${FILE_HEADER}\n\n.rule {}`;

	const fs = {readFile: sinon.stub()};

	const output = await (new LibraryLessGenerator({fs})).generate({
		filePath: "/resources/sap/foo/themes/base/library.source.less",
		fileContent: input
	});

	t.is(output, expectedOutput);
	t.is(fs.readFile.callCount, 0, "fs.readFile should not be called");
	t.is(loggerStub.error.callCount, 0);
});

test.serial("LibraryLessGenerator: File with normal import", async (t) => {
	const {LibraryLessGenerator, loggerStub} = t.context;

	const input = `@import "Foo.less";`;
	const expectedOutput = `${FILE_HEADER}\n\n` +
	`/* START "Foo.less" */\n` +
	`// Content of foo.less\n` +
	`/* END "Foo.less" */\n`;

	const fs = {
		readFile: sinon.stub().callsFake((filePath, options, cb) => {
			switch (filePath) {
			case "/resources/sap/foo/themes/base/Foo.less":
				cb(null, `// Content of foo.less`);
				return;
			}
			const err = new Error("ENOENT: no such file or directory, open " + filePath);
			err.code = "ENOENT";
			cb(err);
		})
	};

	const output = await (new LibraryLessGenerator({fs})).generate({
		filePath: "/resources/sap/foo/themes/base/library.source.less",
		fileContent: input
	});

	t.is(output, expectedOutput);
	t.is(loggerStub.error.callCount, 0);
});

test.serial("LibraryLessGenerator: File with absolute import", async (t) => {
	const {LibraryLessGenerator, loggerStub} = t.context;

	const input = `@import "/resources/sap/foo/themes/base/Foo.less";`;
	const expectedOutput = `${FILE_HEADER}\n\n` +
	`/* START "/resources/sap/foo/themes/base/Foo.less" */\n` +
	`// Content of foo.less\n` +
	`/* END "/resources/sap/foo/themes/base/Foo.less" */\n`;

	const fs = {
		readFile: sinon.stub().callsFake((filePath, options, cb) => {
			switch (filePath) {
			case "/resources/sap/foo/themes/base/Foo.less":
				cb(null, `// Content of foo.less`);
				return;
			}
			const err = new Error("ENOENT: no such file or directory, open " + filePath);
			err.code = "ENOENT";
			cb(err);
		})
	};

	const output = await (new LibraryLessGenerator({fs})).generate({
		filePath: "/resources/sap/foo/themes/base/library.source.less",
		fileContent: input
	});

	t.is(output, expectedOutput);
	t.is(loggerStub.error.callCount, 0);
});

test.serial("LibraryLessGenerator: File with multiple imports", async (t) => {
	const {LibraryLessGenerator, loggerStub} = t.context;

	const input = `
@import "File1.less";
@import "File2.less";
@import "File3.less";
@import "File4.less";
@import (less) "File5.css";
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

/* START "File5.css" */
// Content of /resources/sap/foo/themes/base/File5.css
/* END "File5.css" */

`;

	const fs = {
		readFile: sinon.stub().callsFake((filePath, options, cb) => {
			cb(null, `// Content of ${filePath}`);
		})
	};

	const output = await (new LibraryLessGenerator({fs})).generate({
		filePath: "/resources/sap/foo/themes/base/library.source.less",
		fileContent: input
	});

	t.is(output, expectedOutput);
	t.is(loggerStub.error.callCount, 0);
});

test.serial("LibraryLessGenerator: File with nested imports", async (t) => {
	const {LibraryLessGenerator, loggerStub} = t.context;

	const input = `// Content of input\n` +
	`@import "Foo.less";`;
	const expectedOutput = `${FILE_HEADER}\n\n` +
	`// Content of input\n` +
	`/* START "Foo.less" */\n` +
	`// Content of Foo.less\n` +
	`/* START "Bar.less" */\n` +
	`// Content of Bar.less\n` +
	`/* END "Bar.less" */\n` +
	`\n` +
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
				cb(null, `// Content of Bar.less`);
				return;
			}
			const err = new Error("ENOENT: no such file or directory, open " + filePath);
			err.code = "ENOENT";
			cb(err);
		})
	};

	const output = await (new LibraryLessGenerator({fs})).generate({
		filePath: "/resources/sap/foo/themes/base/library.source.less",
		fileContent: input
	});

	t.is(output, expectedOutput);
	t.is(loggerStub.error.callCount, 0);
});

test.serial("LibraryLessGenerator: No rewrite for sap.ui.core global.less", async (t) => {
	const {LibraryLessGenerator, loggerStub} = t.context;

	const input = `@import "global.less";`;
	const expectedOutput = `${FILE_HEADER}\n\n` +
	`@import "global.less";`;

	const fs = {
		readFile: sinon.stub().callsFake((filePath, options, cb) => {
			const err = new Error("ENOENT: no such file or directory, open " + filePath);
			err.code = "ENOENT";
			cb(err);
		})
	};

	const output = await (new LibraryLessGenerator({fs})).generate({
		filePath: "/resources/sap/ui/core/themes/base/library.source.less",
		fileContent: input
	});

	t.is(output, expectedOutput);
	t.is(fs.readFile.callCount, 0, "fs.readFile should not be called");
	t.is(loggerStub.error.callCount, 0);
});

test.serial("LibraryLessGenerator: No special handling for legacy sap.ui.core global.css", async (t) => {
	const {LibraryLessGenerator, loggerStub} = t.context;

	const input = `@import (less) "global.css";`;
	const expectedOutput = `${FILE_HEADER}\n\n` +
	`/* START "global.css" */\n` +
	`// Content of global.css\n` +
	`/* END "global.css" */\n`;

	const fs = {
		readFile: sinon.stub().callsFake((filePath, options, cb) => {
			switch (filePath) {
			case "/resources/sap/ui/core/themes/base/global.css":
				cb(null, `// Content of global.css`);
				return;
			}
			const err = new Error("ENOENT: no such file or directory, open " + filePath);
			err.code = "ENOENT";
			cb(err);
		})
	};

	const output = await (new LibraryLessGenerator({fs})).generate({
		filePath: "/resources/sap/ui/core/themes/base/library.source.less",
		fileContent: input
	});

	t.is(output, expectedOutput);
	t.is(loggerStub.error.callCount, 0);
});

test.serial("LibraryLessGenerator: Rewrite for sap.ui.core base.less", async (t) => {
	const {LibraryLessGenerator, loggerStub} = t.context;

	const input = `@import "../base/base.less";\n` +
		`@import "base.less";`;
	const expectedOutput = `${FILE_HEADER}\n\n` +
	`@import "../../../../../../Base/baseLib/baseTheme/base.less"; ` +
		`/* ORIGINAL IMPORT PATH: "../base/base.less" */\n\n` +
	`@import "../../../../../../Base/baseLib/sap_fiori_3/base.less"; ` +
		`/* ORIGINAL IMPORT PATH: "base.less" */\n`;

	const fs = {
		readFile: sinon.stub().callsFake((filePath, options, cb) => {
			const err = new Error("ENOENT: no such file or directory, open " + filePath);
			err.code = "ENOENT";
			cb(err);
		})
	};

	const output = await (new LibraryLessGenerator({fs})).generate({
		filePath: "/resources/sap/ui/core/themes/sap_fiori_3/library.source.less",
		fileContent: input
	});

	t.is(output, expectedOutput);
	t.is(fs.readFile.callCount, 0, "fs.readFile should not be called");
	t.is(loggerStub.error.callCount, 0);
});

test.serial("LibraryLessGenerator: Rewrite for sap.ui.core base.less (from different library)", async (t) => {
	const {LibraryLessGenerator, loggerStub} = t.context;

	const input = `@import "../../../../sap/ui/core/themes/base/base.less";\n` +
		`@import "../../../../sap/ui/core/themes/sap_fiori_3/base.less";`;
	const expectedOutput = `${FILE_HEADER}\n\n` +
	`@import "../../../../../Base/baseLib/baseTheme/base.less"; ` +
		`/* ORIGINAL IMPORT PATH: "../../../../sap/ui/core/themes/base/base.less" */\n\n` +
	`@import "../../../../../Base/baseLib/sap_fiori_3/base.less"; ` +
		`/* ORIGINAL IMPORT PATH: "../../../../sap/ui/core/themes/sap_fiori_3/base.less" */\n`;

	const fs = {
		readFile: sinon.stub().callsFake((filePath, options, cb) => {
			const err = new Error("ENOENT: no such file or directory, open " + filePath);
			err.code = "ENOENT";
			cb(err);
		})
	};

	const output = await (new LibraryLessGenerator({fs})).generate({
		filePath: "/resources/sap/f/themes/sap_fiori_3/library.source.less",
		fileContent: input
	});

	t.is(output, expectedOutput);
	t.is(fs.readFile.callCount, 0, "fs.readFile should not be called");
	t.is(loggerStub.error.callCount, 0);
});

test.serial("LibraryLessGenerator: Rewrite for library.source.less", async (t) => {
	const {LibraryLessGenerator, loggerStub} = t.context;

	const input = `@import "../base/library.source.less";`;
	const expectedOutput = `${FILE_HEADER}\n\n` +
	`@import "../base/library.less";`;

	const fs = {
		readFile: sinon.stub().callsFake((filePath, options, cb) => {
			const err = new Error("ENOENT: no such file or directory, open " + filePath);
			err.code = "ENOENT";
			cb(err);
		})
	};

	const output = await (new LibraryLessGenerator({fs})).generate({
		filePath: "/resources/sap/ui/core/themes/sap_fiori_3/library.source.less",
		fileContent: input
	});

	t.is(output, expectedOutput);
	t.is(fs.readFile.callCount, 0, "fs.readFile should not be called");
	t.is(loggerStub.error.callCount, 0);
});

test.serial("LibraryLessGenerator: loggerStub error for file in sub-directory", async (t) => {
	const {LibraryLessGenerator, loggerStub} = t.context;

	const input = `@import "foo/bar.less";`;
	const expectedOutput = `${FILE_HEADER}\n\n` +
	`@import "foo/bar.less"; /* ImportError: Could not inline import outside of theme directory */`;

	const fs = {
		readFile: sinon.stub().callsFake((filePath, options, cb) => {
			const err = new Error("ENOENT: no such file or directory, open " + filePath);
			err.code = "ENOENT";
			cb(err);
		})
	};

	const output = await (new LibraryLessGenerator({fs})).generate({
		filePath: "/resources/sap/ui/core/themes/sap_fiori_3/library.source.less",
		fileContent: input
	});

	t.is(output, expectedOutput);
	t.is(fs.readFile.callCount, 0, "fs.readFile should not be called");
	t.is(loggerStub.error.callCount, 1);
	t.deepEqual(loggerStub.error.getCall(0).args, [
		"Could not inline import '/resources/sap/ui/core/themes/sap_fiori_3/foo/bar.less' " +
		"outside of theme directory '/resources/sap/ui/core/themes/sap_fiori_3'. " +
		"Stylesheets must be located in the theme directory (no sub-directories). " +
		"The generated '/resources/sap/ui/core/themes/sap_fiori_3/library.less' will cause " +
		"errors when compiled with the Theme Designer."
	]);
});

test.serial("LibraryLessGenerator: loggerStub error for file outside of theme directory", async (t) => {
	const {LibraryLessGenerator, loggerStub} = t.context;

	const input = `@import "../foo/bar.less";`;
	const expectedOutput = `${FILE_HEADER}\n\n` +
	`@import "../foo/bar.less"; /* ImportError: Could not inline import outside of theme directory */`;

	const fs = {
		readFile: sinon.stub().callsFake((filePath, options, cb) => {
			const err = new Error("ENOENT: no such file or directory, open " + filePath);
			err.code = "ENOENT";
			cb(err);
		})
	};

	const output = await (new LibraryLessGenerator({fs})).generate({
		filePath: "/resources/sap/ui/core/themes/sap_fiori_3/library.source.less",
		fileContent: input
	});

	t.is(output, expectedOutput);
	t.is(fs.readFile.callCount, 0, "fs.readFile should not be called");
	t.is(loggerStub.error.callCount, 1);
	t.deepEqual(loggerStub.error.getCall(0).args, [
		"Could not inline import '/resources/sap/ui/core/themes/foo/bar.less' " +
		"outside of theme directory '/resources/sap/ui/core/themes/sap_fiori_3'. " +
		"Stylesheets must be located in the theme directory (no sub-directories). " +
		"The generated '/resources/sap/ui/core/themes/sap_fiori_3/library.less' will cause " +
		"errors when compiled with the Theme Designer."
	]);
});

test.serial("LibraryLessGenerator: loggerStub error for absolute import outside of theme directory", async (t) => {
	const {LibraryLessGenerator, loggerStub} = t.context;

	const input = `@import "/foo/bar.less";`;
	const expectedOutput = `${FILE_HEADER}\n\n` +
	`@import "/foo/bar.less"; /* ImportError: Could not inline import outside of theme directory */`;

	const fs = {
		readFile: sinon.stub().callsFake((filePath, options, cb) => {
			const err = new Error("ENOENT: no such file or directory, open " + filePath);
			err.code = "ENOENT";
			cb(err);
		})
	};

	const output = await (new LibraryLessGenerator({fs})).generate({
		filePath: "/resources/sap/ui/core/themes/sap_fiori_3/library.source.less",
		fileContent: input
	});

	t.is(output, expectedOutput);
	t.is(fs.readFile.callCount, 0, "fs.readFile should not be called");
	t.is(loggerStub.error.callCount, 1);
	t.deepEqual(loggerStub.error.getCall(0).args, [
		"Could not inline import '/foo/bar.less' " +
		"outside of theme directory '/resources/sap/ui/core/themes/sap_fiori_3'. " +
		"Stylesheets must be located in the theme directory (no sub-directories). " +
		"The generated '/resources/sap/ui/core/themes/sap_fiori_3/library.less' will cause " +
		"errors when compiled with the Theme Designer."
	]);
});

test.serial("LibraryLessGenerator: Throw error when file can't be found", async (t) => {
	const {LibraryLessGenerator, loggerStub} = t.context;

	const input = `@import "foo.less";`;

	const fs = {
		readFile: sinon.stub().callsFake((filePath, options, cb) => {
			const err = new Error("ENOENT: no such file or directory, open " + filePath);
			err.code = "ENOENT";
			cb(err);
		})
	};

	await t.throwsAsync((new LibraryLessGenerator({fs})).generate({
		filePath: "/resources/sap/ui/core/themes/sap_fiori_3/library.source.less",
		fileContent: input
	}), {
		message:
		`libraryLessGenerator: Unable to resolve import 'foo.less' from ` +
		`'/resources/sap/ui/core/themes/sap_fiori_3'\n` +
		`ENOENT: no such file or directory, open /resources/sap/ui/core/themes/sap_fiori_3/foo.less`
	});

	t.is(fs.readFile.callCount, 1, "fs.readFile should be called once");
	t.is(loggerStub.error.callCount, 0);
});

test.serial("LibraryLessGenerator: Throw error when readFile fails", async (t) => {
	const {LibraryLessGenerator, loggerStub} = t.context;

	const input = `@import "foo.less";`;

	const fs = {
		readFile: sinon.stub().callsFake((filePath, options, cb) => {
			const err = new Error("Unexpected error from fs.readFile");
			cb(err);
		})
	};

	await t.throwsAsync((new LibraryLessGenerator({fs})).generate({
		filePath: "/resources/sap/ui/core/themes/sap_fiori_3/library.source.less",
		fileContent: input
	}), {
		message:
		`Unexpected error from fs.readFile`
	});

	t.is(fs.readFile.callCount, 1, "fs.readFile should be called once");
	t.is(loggerStub.error.callCount, 0);
});

test.serial("LibraryLessGenerator.getPathToRoot", (t) => {
	const {LibraryLessGenerator, loggerStub} = t.context;

	t.is(
		LibraryLessGenerator.getPathToRoot("/resources/sap/ui/core/themes/base"),
		"../../../../../../"
	);
	t.is(
		LibraryLessGenerator.getPathToRoot("/resources/sap/f/themes/sap_fiori_3"),
		"../../../../../"
	);
	t.is(loggerStub.error.callCount, 0);
});
