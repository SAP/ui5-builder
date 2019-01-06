const {test} = require("ava");
const path = require("path");
const chai = require("chai");
const sinon = require("sinon");
chai.use(require("chai-fs"));

test.afterEach.always((t) => {
	sinon.restore();
});

const LibraryFormatter = require("../../../../lib/types/library/LibraryFormatter");

const libraryEPath = path.join(__dirname, "..", "..", "..", "fixtures", "library.e");
const libraryETree = {
	id: "library.e",
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
	const libraryFormatter = new LibraryFormatter();

	// error is thrown because project is not defined (null)
	const error = await t.throws(libraryFormatter.validate(null));
	t.deepEqual(error.message, "Project is undefined", "Correct exception thrown");
});

test("validate: empty version", async (t) => {
	const myProject = clone(libraryETree);
	myProject.version = undefined;
	const libraryFormatter = new LibraryFormatter();

	// error is thrown because project's version is not defined
	const error = await t.throws(libraryFormatter.validate(myProject));
	t.deepEqual(error.message, `"version" is missing for project library.e`, "Correct exception thrown");
});

test("validate: empty type", async (t) => {
	const myProject = clone(libraryETree);
	myProject.type = undefined;
	const libraryFormatter = new LibraryFormatter();

	// error is thrown because project's type is not defined
	const error = await t.throws(libraryFormatter.validate(myProject));
	t.deepEqual(error.message, `"type" configuration is missing for project library.e`, "Correct exception thrown");
});


test("validate: empty metadata", async (t) => {
	const myProject = clone(libraryETree);
	myProject.metadata = undefined;
	const libraryFormatter = new LibraryFormatter();

	// error is thrown because project's metadata is not defined
	const error = await t.throws(libraryFormatter.validate(myProject));
	t.deepEqual(error.message, `"metadata.name" configuration is missing for project library.e`,
		"Correct exception thrown");
});

test("validate: empty resources", async (t) => {
	const myProject = clone(libraryETree);
	myProject.resources = undefined;
	const libraryFormatter = new LibraryFormatter();

	await libraryFormatter.validate(myProject);
	t.deepEqual(myProject.resources.configuration.paths.src, "src", "default src directory is set");
	t.deepEqual(myProject.resources.configuration.paths.test, "test", "default test directory is set");
});

test("validate: src directory does not exist", async (t) => {
	const myProject = clone(libraryETree);
	const libraryFormatter = new LibraryFormatter();
	const dirExists = sinon.stub(libraryFormatter, "dirExists");
	dirExists.onFirstCall().resolves(false);
	dirExists.onSecondCall().resolves(true);

	const error = await await t.throws(libraryFormatter.validate(myProject));
	t.regex(error.message, /^Could not find source directory of project library.e: (?!(undefined))+/,
		"Missing source directory caused error");
});

test("validate: test directory does not exist", async (t) => {
	const myProject = clone(libraryETree);
	const libraryFormatter = new LibraryFormatter();
	const dirExists = sinon.stub(libraryFormatter, "dirExists");
	dirExists.onFirstCall().resolves(true);
	dirExists.onSecondCall().resolves(false);

	await libraryFormatter.validate(myProject);
	// Missing test directory is not an error
	t.deepEqual(myProject.resources.configuration.paths.test, null, "Project test path configuration is set to nul");
});

test("format: copyright already configured", async (t) => {
	const myProject = clone(libraryETree);
	const libraryFormatter = new LibraryFormatter();
	sinon.stub(libraryFormatter, "validate").resolves();

	await libraryFormatter.format(myProject);
	t.deepEqual(myProject.metadata.copyright, libraryETree.metadata.copyright, "Copyright was not altered");
});

/*
test("format: no dot library file", async (t) => {
	const myProject = clone(libraryETree);
	myProject.metadata.copyright = undefined;
	const libraryFormatter = new LibraryFormatter();
	sinon.stub(libraryFormatter, "validate").resolves();
	// sinon.stub(libraryFormatter, "glob").resolves([]);
	await libraryFormatter.format(myProject);
	// TODO stub glob and logger and check it
	t.falsy(myProject.metadata.copyright);
});*/

// TODO stub glob and test exception when multiple .library files are found

test("format: takes copyright from .library", async (t) => {
	const myProject = clone(libraryETree);
	myProject.metadata.copyright = undefined; // Simulate unconfigured copyright
	const libraryFormatter = new LibraryFormatter();
	sinon.stub(libraryFormatter, "validate").resolves();
	await libraryFormatter.format(myProject);
	t.deepEqual(myProject.metadata.copyright, "${copyright}", "Correct copyright set");
});

test("format: configuration test path", async (t) => {
	const myProject = clone(libraryETree);
	const libraryFormatter = new LibraryFormatter();
	sinon.stub(libraryFormatter, "validate").resolves();
	myProject.resources.configuration.paths.test = null;
	await libraryFormatter.format(myProject);

	t.falsy(myProject.resources.pathMappings["/test-resources/"], "test-resources pathMapping is not set");
});
