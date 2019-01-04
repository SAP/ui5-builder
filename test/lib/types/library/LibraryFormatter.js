const {test} = require("ava");
const path = require("path");
const chai = require("chai");
const sinon = require("sinon");
chai.use(require("chai-fs"));

const LibraryFormatter = require("../../../../lib/types/library/LibraryFormatter");

const libraryEPath = path.join(__dirname, "..", "..", "..", "fixtures", "library.e");
const libraryETree = {
	"id": "library.e",
	"version": "1.0.0",
	"path": libraryEPath,
	"dependencies": [],
	"_level": 0,
	"specVersion": "0.1",
	"type": "library",
	"metadata": {
		"name": "library.e",
		"copyright": "UI development toolkit for HTML5 (OpenUI5)\n * (c) Copyright 2009-xxx SAP SE or an SAP affiliate company.\n * Licensed under the Apache License, Version 2.0 - see LICENSE.txt."
	},
	"resources": {
		"configuration": {
			"paths": {
				"src": "src",
				"test": "test"
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
	t.deepEqual(error.message, "Project is undefined");
});

test("validate: empty version", async (t) => {
	const myProject = clone(libraryETree);
	myProject.version = undefined;
	const libraryFormatter = new LibraryFormatter();

	// error is thrown because project's version is not defined
	const error = await t.throws(libraryFormatter.validate(myProject));
	t.deepEqual(error.message, "\"version\" is missing for project library.e");
});

test("validate: empty type", async (t) => {
	const myProject = clone(libraryETree);
	myProject.type = undefined;
	const libraryFormatter = new LibraryFormatter();

	// error is thrown because project's type is not defined
	const error = await t.throws(libraryFormatter.validate(myProject));
	t.deepEqual(error.message, "\"type\" configuration is missing for project library.e");
});


test("validate: empty metadata", async (t) => {
	const myProject = clone(libraryETree);
	myProject.metadata = undefined;
	const libraryFormatter = new LibraryFormatter();

	// error is thrown because project's metadata is not defined
	const error = await t.throws(libraryFormatter.validate(myProject));
	t.deepEqual(error.message, "\"metadata.name\" configuration is missing for project library.e");
});

test("validate: project resources", async (t) => {
	const myProject = clone(libraryETree);
	myProject.resources = undefined;
	const libraryFormatter = new LibraryFormatter();

	// error is thrown because project's resources are not defined
	await libraryFormatter.validate(myProject);
	t.deepEqual(myProject.resources.configuration.paths.src, "src", "default webapp folder is set");
	t.deepEqual(myProject.resources.configuration.paths.test, "test", "default webapp folder is set");
});

test("LibraryFormatter#validate: second folder does not exist", async (t) => {
	const myProject = clone(libraryETree);
	const libraryFormatter = new LibraryFormatter();
	const dirExists = sinon.stub(libraryFormatter, "dirExists");
	dirExists.onFirstCall().resolves(true);
	dirExists.onSecondCall().resolves(false);

	return libraryFormatter.validate(myProject).then((oRes) => {
		t.truthy(oRes, "Project is undefined");
		t.pass();
	});
});

test("LibraryFormatter#validate: first folder does not exist", async (t) => {
	const myProject = clone(libraryETree);
	const libraryFormatter = new LibraryFormatter();
	const dirExists = sinon.stub(libraryFormatter, "dirExists");
	dirExists.onFirstCall().resolves(false);
	dirExists.onSecondCall().resolves(true);

	return libraryFormatter.validate(myProject).catch((error) => {
		t.true(error.message && error.message.startsWith("Could not find source directory of project library.e: "));
		t.pass();
	});
});


test("LibraryFormatter#format: pass through", async (t) => {
	const myProject = clone(libraryETree);
	const libraryFormatter = new LibraryFormatter();
	sinon.stub(libraryFormatter, "validate").resolves();

	return libraryFormatter.format(myProject).then((oRes) => {
		t.falsy(oRes);
		t.pass();
	});
});

test("LibraryFormatter#format: copyright", async (t) => {
	const myProject = clone(libraryETree);
	myProject.metadata.copyright = "mine";
	const libraryFormatter = new LibraryFormatter();
	sinon.stub(libraryFormatter, "validate").resolves();

	return libraryFormatter.format(myProject).then((oRes) => {
		t.falsy(oRes);
		t.pass();
	});
});

test("LibraryFormatter#format: no dot library files", async (t) => {
	const myProject = clone(libraryETree);
	myProject.metadata.copyright = false;
	myProject.path = myProject.path + "non-existing";
	const libraryFormatter = new LibraryFormatter();
	sinon.stub(libraryFormatter, "validate").resolves();
	await libraryFormatter.format(myProject);
	// TODO stub logger and check it
	t.falsy(myProject.metadata.copyright);
});

test("LibraryFormatter#format: go through", async (t) => {
	const myProject = clone(libraryETree);
	myProject.metadata.copyright = false;
	const libraryFormatter = new LibraryFormatter();
	sinon.stub(libraryFormatter, "validate").resolves();
	await libraryFormatter.format(myProject);
	t.deepEqual(myProject.metadata.copyright, "${copyright}");
});

test("LibraryFormatter#format: configuration test path", async (t) => {
	const myProject = clone(libraryETree);
	const libraryFormatter = new LibraryFormatter();
	sinon.stub(libraryFormatter, "validate").resolves();
	myProject.resources.configuration.paths.test = null;
	await libraryFormatter.format(myProject);

	t.falsy(myProject.resources.configuration.paths.test, "Some fancy copyright");
	t.falsy(myProject.resources.pathMappings["/test-resources/"], "test-resources pathMapping is not set");
});
