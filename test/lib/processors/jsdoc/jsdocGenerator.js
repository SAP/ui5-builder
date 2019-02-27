const path = require("path");
const {test} = require("ava");
const sinon = require("sinon");
const mock = require("mock-require");
const jsdocGenerator = require("../../../../lib/processors/jsdoc/jsdocGenerator");

test("generateJsdocConfig", async (t) => {
	const res = await jsdocGenerator._generateJsdocConfig({
		sourcePath: "/some/source/path",
		targetPath: "/some/target/path",
		namespace: "some/namespace",
		libraryName: "some.namespace",
		version: "1.0.0",
		variants: ["apijson"]
	});

	const jsdocGeneratorPath = path.resolve(__dirname, "..", "..", "..", "..", "lib", "processors",
		"jsdoc");

	t.deepEqual(res, `{
		"plugins": ["${jsdocGeneratorPath}/ui5/plugin.js"],
		"opts": {
			"recurse": true,
			"lenient": true,
			"template": "${jsdocGeneratorPath}/ui5/template",
			"ui5": {
				"saveSymbols": true
			}
		},
		"templates": {
			"ui5": {
				"variants": ["apijson"],
				"version": "1.0.0",
				"jsapiFile": "/some/target/path/libraries/some.namespace.js",
				"apiJsonFolder": "/some/target/path/dependency-apis",
				"apiJsonFile": "/some/target/path/test-resources/some/namespace/designtime/api.json"
			}
		}
	}`, "Correct config generated");
});

test.serial("writeJsdocConfig", async (t) => {
	mock("fs", {
		writeFile: (configPath, configContent, callback) => {
			t.deepEqual(configPath, "/some/path/jsdoc-config.json", "Correct config path supplied");
			t.deepEqual(configContent, "some config", "Correct config content supplied");
			callback();
		}
	});
	mock.reRequire("fs");

	// Re-require tested module
	const jsdocGenerator = mock.reRequire("../../../../lib/processors/jsdoc/jsdocGenerator");
	const res = await jsdocGenerator._writeJsdocConfig("/some/path", "some config");

	t.deepEqual(res, "/some/path/jsdoc-config.json", "Correct config path returned");

	mock.stop("fs");
});

test.serial("buildJsdoc", async (t) => {
	const childProcess = require("child_process");
	let exitCode = 0;
	const cpStub = sinon.stub(childProcess, "spawn").returns({
		on: (event, callback) => {
			callback(exitCode);
		}
	});
	const jsdocGenerator = mock.reRequire("../../../../lib/processors/jsdoc/jsdocGenerator");

	await jsdocGenerator._buildJsdoc({
		sourcePath: "/some/path",
		configPath: "/some/config/path/jsdoc-config.json"
	});
	t.deepEqual(cpStub.callCount, 1, "Spawn got called");

	const firstCallArgs = cpStub.getCall(0).args;
	t.deepEqual(firstCallArgs[0], "node", "Spawn got called with correct process argument");
	t.deepEqual(firstCallArgs[1], [
		path.resolve(__dirname, "..", "..", "..", "..", "node_modules", "jsdoc", "jsdoc.js"),
		"-c",
		"/some/config/path/jsdoc-config.json",
		"--verbose",
		"/some/path"
	], "Spawn got called with correct arguments");


	// Re-execute with exit code 1
	exitCode = 1;
	await t.notThrows(jsdocGenerator._buildJsdoc({
		sourcePath: "/some/path",
		configPath: "/some/config/path/jsdoc-config.json"
	}));

	// Re-execute with exit code 2
	exitCode = 2;
	const error = await t.throws(jsdocGenerator._buildJsdoc({
		sourcePath: "/some/path",
		configPath: "/some/config/path/jsdoc-config.json"
	}));
	t.deepEqual(error.message, "JSDoc child process closed with code 2");
});
