const test = require("ava");
const path = require("path");
const sinon = require("sinon");
const mock = require("mock-require");

test.afterEach.always((t) => {
	sinon.restore();
});

const LibraryFormatter = require("../../../../lib/types/library/LibraryFormatter");

const libraryEPath = path.join(__dirname, "..", "..", "..", "fixtures", "library.e");
const libraryETree = {
	id: "library.e.id",
	version: "1.0.0",
	path: libraryEPath,
	dependencies: [],
	_level: 0,
	specVersion: "0.1",
	type: "library",
	metadata: {
		name: "library.e",
		copyright: "UI development toolkit for HTML5 (OpenUI5)\n * (c) Copyright 2009-xxx SAP SE or an SAP affiliate " +
			"company.\n * Licensed under the Apache License, Version 2.0 - see LICENSE.txt."
	},
	resources: {
		configuration: {
			paths: {
				src: "src",
				test: "test"
			}
		}
	}
};

function clone(o) {
	return JSON.parse(JSON.stringify(o));
}

test("validate: project not defined", async (t) => {
	const libraryFormatter = new LibraryFormatter({project: null});

	// error is thrown because project is not defined (null)
	const error = await t.throwsAsync(libraryFormatter.validate());
	t.deepEqual(error.message, "Project is undefined", "Correct exception thrown");
});

test("validate: empty version", async (t) => {
	const myProject = clone(libraryETree);
	myProject.version = undefined;
	const libraryFormatter = new LibraryFormatter({project: myProject});

	// error is thrown because project's version is not defined
	const error = await t.throwsAsync(libraryFormatter.validate(myProject));
	t.deepEqual(error.message, `"version" is missing for project library.e.id`, "Correct exception thrown");
});

test("validate: empty type", async (t) => {
	const myProject = clone(libraryETree);
	myProject.type = undefined;
	const libraryFormatter = new LibraryFormatter({project: myProject});

	// error is thrown because project's type is not defined
	const error = await t.throwsAsync(libraryFormatter.validate(myProject));
	t.deepEqual(error.message, `"type" configuration is missing for project library.e.id`, "Correct exception thrown");
});


test("validate: empty metadata", async (t) => {
	const myProject = clone(libraryETree);
	myProject.metadata = undefined;
	const libraryFormatter = new LibraryFormatter({project: myProject});

	// error is thrown because project's metadata is not defined
	const error = await t.throwsAsync(libraryFormatter.validate(myProject));
	t.deepEqual(error.message, `"metadata.name" configuration is missing for project library.e.id`,
		"Correct exception thrown");
});

test("validate: empty resources", async (t) => {
	const myProject = clone(libraryETree);
	myProject.resources = undefined;
	const libraryFormatter = new LibraryFormatter({project: myProject});

	await libraryFormatter.validate(myProject);
	t.deepEqual(myProject.resources.configuration.paths.src, "src", "default src directory is set");
	t.deepEqual(myProject.resources.configuration.paths.test, "test", "default test directory is set");
});

test("validate: src directory does not exist", async (t) => {
	const myProject = clone(libraryETree);
	const libraryFormatter = new LibraryFormatter({project: myProject});
	const dirExists = sinon.stub(libraryFormatter, "dirExists");
	dirExists.onFirstCall().resolves(false);
	dirExists.onSecondCall().resolves(true);

	const error = await await t.throwsAsync(libraryFormatter.validate(myProject));
	t.regex(error.message, /^Could not find source directory of project library\.e\.id: (?!(undefined))+/,
		"Missing source directory caused error");
});

test("validate: test directory does not exist", async (t) => {
	const myProject = clone(libraryETree);
	const libraryFormatter = new LibraryFormatter({project: myProject});
	const dirExists = sinon.stub(libraryFormatter, "dirExists");
	dirExists.onFirstCall().resolves(true);
	dirExists.onSecondCall().resolves(false);

	await libraryFormatter.validate(myProject);
	// Missing test directory is not an error
	t.deepEqual(myProject.resources.configuration.paths.test, null, "Project test path configuration is set to nul");
});

test("format: copyright already configured", async (t) => {
	const myProject = clone(libraryETree);
	const libraryFormatter = new LibraryFormatter({project: myProject});
	sinon.stub(libraryFormatter, "validate").resolves();

	await libraryFormatter.format();
	t.deepEqual(myProject.metadata.copyright, libraryETree.metadata.copyright, "Copyright was not altered");
});


test.serial("format: no dot library file", async (t) => {
	const myProject = clone(libraryETree);
	myProject.metadata.copyright = undefined;


	mock("globby", function(name) {
		t.deepEqual(name, "**/.library", "Glob for .library files");
		return Promise.resolve([]);
	});
	mock.reRequire("globby");


	const log = require("@ui5/logger");
	const loggerInstance = log.getLogger("types:library:LibraryFormatter");

	mock("@ui5/logger", {
		getLogger: () => loggerInstance
	});
	mock.reRequire("@ui5/logger");
	const loggerSpy = sinon.spy(loggerInstance, "warn");


	const LibraryFormatter = mock.reRequire("../../../../lib/types/library/LibraryFormatter");

	const libraryFormatter = new LibraryFormatter({project: myProject});
	sinon.stub(libraryFormatter, "validate").resolves();


	await libraryFormatter.format();
	t.deepEqual(loggerSpy.callCount, 1, "1 calls to warn should be done");
	t.true(loggerSpy.getCalls().map((call) => call.args[0]).includes(
		"Namespace resolution from .library failed for project library.e: " +
		"Could not find .library file for project library.e"),
	"should contain message for .library");
	mock.stop("globby");
	mock.stop("@ui5/logger");
});

test("format: configuration test path", async (t) => {
	const myProject = clone(libraryETree);
	const libraryFormatter = new LibraryFormatter({project: myProject});
	sinon.stub(libraryFormatter, "validate").resolves();
	myProject.resources.configuration.paths.test = null;
	await libraryFormatter.format();

	t.falsy(myProject.resources.pathMappings["/test-resources/"], "test-resources pathMapping is not set");
});

test("getDotLibrary: reads correctly", async (t) => {
	const myProject = clone(libraryETree);
	myProject.resources.pathMappings = {
		"/resources/": myProject.resources.configuration.paths.src
	};

	const libraryFormatter = new LibraryFormatter({project: myProject});

	const res = await libraryFormatter.getDotLibrary();
	t.deepEqual(res.library.name, "library.e", ".library content has been read");
});

test.serial("getDotLibrary: multiple dot library files", async (t) => {
	const myProject = clone(libraryETree);
	myProject.resources.pathMappings = {
		"/resources/": myProject.resources.configuration.paths.src
	};

	mock("globby", function(name) {
		t.deepEqual(name, "**/.library", "Glob for .library files");
		return Promise.resolve(["folder1/.library", "folder2/.library"]);
	});
	mock.reRequire("globby");

	const LibraryFormatter = mock.reRequire("../../../../lib/types/library/LibraryFormatter");

	const libraryFormatter = new LibraryFormatter({project: myProject});
	const error = await t.throwsAsync(libraryFormatter.getDotLibrary());
	t.deepEqual(error.message, "Found multiple (2) .library files for project library.e",
		"Rejected with correct error message");
	mock.stop("globby");
});

test.serial("getDotLibrary: no dot library file", async (t) => {
	const myProject = clone(libraryETree);
	myProject.resources.pathMappings = {
		"/resources/": myProject.resources.configuration.paths.src
	};

	mock("globby", function(name) {
		return Promise.resolve([]);
	});
	mock.reRequire("globby");

	const LibraryFormatter = mock.reRequire("../../../../lib/types/library/LibraryFormatter");

	const libraryFormatter = new LibraryFormatter({project: myProject});

	const error = await t.throwsAsync(libraryFormatter.getDotLibrary());
	t.deepEqual(error.message, "Could not find .library file for project library.e",
		"Rejected with correct error message");
	mock.stop("globby");
});

test.serial("getDotLibrary: result is cached", async (t) => {
	const myProject = clone(libraryETree);
	myProject.resources.pathMappings = {
		"/resources/": myProject.resources.configuration.paths.src
	};
	const globby = require("globby");
	const globbySpy = sinon.spy(globby);
	mock("globby", globbySpy);
	mock.reRequire("globby");

	const LibraryFormatter = mock.reRequire("../../../../lib/types/library/LibraryFormatter");

	const libraryFormatter = new LibraryFormatter({project: myProject});

	const res = await libraryFormatter.getDotLibrary();
	t.deepEqual(res.library.name, "library.e", ".library content has been read");

	t.deepEqual(globbySpy.callCount, 1,
		"globby got called exactly once (and then cached)");
	mock.stop("globby");
});

test("getCopyright: takes copyright from project configuration", async (t) => {
	const myProject = clone(libraryETree);
	myProject.metadata.copyright = "unicorn"; // Simulate configured copyright

	const libraryFormatter = new LibraryFormatter({project: myProject});
	const copyright = await libraryFormatter.getCopyright();
	t.deepEqual(copyright, "unicorn", "Returned correct copyright");
});

test("getCopyright: takes copyright from .library", async (t) => {
	const myProject = clone(libraryETree);
	myProject.metadata.copyright = undefined; // Simulate unconfigured copyright

	const libraryFormatter = new LibraryFormatter({project: myProject});
	sinon.stub(libraryFormatter, "getDotLibrary").resolves({
		library: {copyright: "pony"}
	});
	const res = await libraryFormatter.getCopyright();
	t.deepEqual(res, "pony", "Returned correct copyright");
});

test("getCopyright: no copyright available", async (t) => {
	const myProject = clone(libraryETree);
	myProject.metadata.copyright = undefined; // Simulate unconfigured copyright

	const libraryFormatter = new LibraryFormatter({project: myProject});
	sinon.stub(libraryFormatter, "getDotLibrary").resolves({
		library: {}
	});
	const err = await t.throwsAsync(libraryFormatter.getCopyright());
	t.deepEqual(err.message,
		"No copyright configuration found in .library " +
		"of project library.e",
		"Rejected with correct error message");
});

test("getNamespace: from manifest.json", async (t) => {
	const myProject = clone(libraryETree);

	const libraryFormatter = new LibraryFormatter({project: myProject});
	sinon.stub(libraryFormatter, "getManifest").resolves({
		"sap.app": {
			id: "mani-pony"
		}
	});
	const res = await libraryFormatter.getNamespace();
	t.deepEqual(res, "mani-pony", "Returned correct namespace");
});

test("getNamespace: from .library", async (t) => {
	const myProject = clone(libraryETree);

	const libraryFormatter = new LibraryFormatter({project: myProject});
	sinon.stub(libraryFormatter, "getManifest").rejects("No manifest aint' here");
	sinon.stub(libraryFormatter, "getDotLibrary").resolves({
		library: {name: "dot-pony"}
	});
	const res = await libraryFormatter.getNamespace();
	t.deepEqual(res, "dot-pony", "Returned correct namespace");
});

test("getNamespace: neither manifest nor .library contain it", async (t) => {
	const myProject = clone(libraryETree);

	const libraryFormatter = new LibraryFormatter({project: myProject});
	sinon.stub(libraryFormatter, "getManifest").resolves({});
	sinon.stub(libraryFormatter, "getDotLibrary").resolves({});
	const err = await t.throwsAsync(libraryFormatter.getNamespace());
	t.deepEqual(err.message,
		"Namespace resolution from .library failed for project library.e: " +
		"No library name found in .library of project library.e",
		"Rejected with correct error message");
});

test("getNamespace: from .library with maven placeholder", async (t) => {
	const myProject = clone(libraryETree);

	const libraryFormatter = new LibraryFormatter({project: myProject});
	sinon.stub(libraryFormatter, "getManifest").rejects("No manifest aint' here");
	sinon.stub(libraryFormatter, "getDotLibrary").resolves({
		library: {name: "${mvn-pony}"}
	});
	const resolveMavenPlaceholderStub =
		sinon.stub(libraryFormatter, "resolveMavenPlaceholder").resolves("mvn-unicorn");
	const res = await libraryFormatter.getNamespace();

	t.deepEqual(resolveMavenPlaceholderStub.getCall(0).args[0], "${mvn-pony}",
		"resolveMavenPlaceholder called with correct argument");
	t.deepEqual(res, "mvn-unicorn", "Returned correct namespace");
});

test("getNamespace: maven placeholder resolution fails", async (t) => {
	const myProject = clone(libraryETree);

	const libraryFormatter = new LibraryFormatter({project: myProject});
	sinon.stub(libraryFormatter, "getManifest").resolves({
		"sap.app": {
			id: "${mvn-pony}"
		}
	});
	const resolveMavenPlaceholderStub =
		sinon.stub(libraryFormatter, "resolveMavenPlaceholder")
			.rejects(new Error("because squirrel"));
	const err = await t.throwsAsync(libraryFormatter.getNamespace());
	t.deepEqual(resolveMavenPlaceholderStub.getCall(0).args[0], "${mvn-pony}",
		"resolveMavenPlaceholder called with correct argument");
	t.deepEqual(err.message,
		"Failed to resolve namespace maven placeholder of project library.e: because squirrel",
		"Rejected with correct error message");
});
