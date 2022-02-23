const test = require("ava");
const analyzeLibraryJS = require("../../../../lib/lbt/analyzer/analyzeLibraryJS");

// const globalSinon = require("sinon");

// test.beforeEach((t) => {
// 	t.context.sinon = globalSinon.createSandbox();
// });

// test.afterEach.always((t) => {
// 	t.context.sinon.restore();
// });

test("analyzeLibraryJS: No resource", async (t) => {
	const resource = null;

	const result = await analyzeLibraryJS(resource);

	t.deepEqual(result, {});
});

test("analyzeLibraryJS: Empty resource", async (t) => {
	const resource = {
		async getBuffer() {
			return Buffer.from("", "utf-8");
		}
	};

	const result = await analyzeLibraryJS(resource);

	t.deepEqual(result, {
		controls: [],
		elements: [],
		interfaces: [],
		noLibraryCSS: false,
		types: []
	});
});

test("analyzeLibraryJS: library.js with sap.ui.define", async (t) => {
	const resource = {
		async getBuffer() {
			return Buffer.from(`
sap.ui.define([
	'sap/ui/core/Core',
	'sap/ui/core/library'
], function(Core) {
	sap.ui.getCore().initLibrary({
		name: "test.lib",
		version: "1.2.3",
		dependencies: ["sap.ui.core"],
		types: [
			"test.lib.Type1",
			"test.lib.Type2"
		],
		interfaces: [
			"test.lib.Interface1",
			"test.lib.Interface2"
		],
		controls: [
			"test.lib.Control1",
			"test.lib.Control2"
		],
		elements: [
			"test.lib.Element1",
			"test.lib.Element2"
		],
		noLibraryCSS: true
	});
});
`, "utf-8");
		}
	};

	const result = await analyzeLibraryJS(resource);

	t.deepEqual(result, {
		controls: [
			"test.lib.Control1",
			"test.lib.Control2"
		],
		elements: [
			"test.lib.Element1",
			"test.lib.Element2"
		],
		interfaces: [
			"test.lib.Interface1",
			"test.lib.Interface2"
		],
		noLibraryCSS: true,
		types: [
			"test.lib.Type1",
			"test.lib.Type2"
		]
	});
});

test("analyzeLibraryJS: library.js with sap.ui.define (New ECMAScript features)", async (t) => {
	const resource = {
		async getBuffer() {
			return Buffer.from(`
sap.ui.define([
	'sap/ui/core/Core',
	'sap/ui/core/library'
], (Core) => {
	sap.ui.getCore().initLibrary({
		name: "test.lib",
		version: "1.2.3",
		dependencies: ["sap.ui.core"],
		types: [
			"test.lib.Type1",
			"test.lib.Type2"
		],
		interfaces: [
			"test.lib.Interface1",
			"test.lib.Interface2"
		],
		controls: [
			"test.lib.Control1",
			"test.lib.Control2"
		],
		elements: [
			"test.lib.Element1",
			"test.lib.Element2"
		],
		noLibraryCSS: true
	});
});
`, "utf-8");
		}
	};

	const result = await analyzeLibraryJS(resource);

	t.deepEqual(result, {
		controls: [
			"test.lib.Control1",
			"test.lib.Control2"
		],
		elements: [
			"test.lib.Element1",
			"test.lib.Element2"
		],
		interfaces: [
			"test.lib.Interface1",
			"test.lib.Interface2"
		],
		noLibraryCSS: true,
		types: [
			"test.lib.Type1",
			"test.lib.Type2"
		]
	});
});
