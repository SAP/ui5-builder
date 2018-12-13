const {test} = require("ava");
const path = require("path");
const chai = require("chai");
const sinon = require("sinon");
chai.use(require("chai-fs"));

const LibraryFormatter = require("../../../../lib/types/library/LibraryFormatter");

const libraryBPath = path.join(__dirname, "..", "..", "..", "fixtures", "library.d");
const libraryBTree = {
	"id": "library.d",
	"version": "1.0.0",
	"path": path.join(libraryBPath),
	"dependencies": [],
	"_level": 1,
	"specVersion": "0.1",
	"type": "library",
	"metadata": {
		"name": "library.d",
		"copyright": "Some fancy copyright"
	},
	"resources": {
		"configuration": {
			"paths": {
				"src": "main/src",
				"test": "main/test"
			}
		},
		"pathMappings": {
			"/resources/": "main/src",
			"/test-resources/": "main/test"
		}
	}
};

test("LibraryFormatter#validate: run through", async (t) => {
	const myProject = Object.assign({}, libraryBTree);
	const libraryFormatter = new LibraryFormatter();
	sinon.stub(libraryFormatter, "dirExists").resolves(true);
	return libraryFormatter.validate(myProject).then((oRes) => {
		t.truthy(oRes);
		t.pass();
	});
});

test("LibraryFormatter#validate: project not defined", async (t) => {
	const libraryFormatter = new LibraryFormatter();
	return libraryFormatter.validate(null).catch((error) => {
		t.is(error.message, "Project is undefined");
		t.pass();
	});
});

test("ApplicationFormatter#validate: empty version", async (t) => {
	const myProject = Object.assign({}, libraryBTree);
	myProject.version = undefined;
	const applicationFormatter = new LibraryFormatter();
	return applicationFormatter.validate(myProject).catch((error) => {
		t.is(error.message, "\"version\" is missing for project library.d");
		t.pass();
	});
});

test("ApplicationFormatter#validate: empty type", async (t) => {
	const myProject = Object.assign({}, libraryBTree);
	myProject.type = undefined;
	const applicationFormatter = new LibraryFormatter();
	return applicationFormatter.validate(myProject).catch((error) => {
		t.is(error.message, "\"type\" configuration is missing for project library.d");
		t.pass();
	});
});


test("ApplicationFormatter#validate: metadata", async (t) => {
	const myProject = Object.assign({}, libraryBTree);
	myProject.metadata = undefined;
	const applicationFormatter = new LibraryFormatter();
	return applicationFormatter.validate(myProject).catch((error) => {
		t.is(error.message, "\"metadata.name\" configuration is missing for project library.d");
		t.pass();
	});
});

test("LibraryFormatter#validate: resources", async (t) => {
	const myProject = Object.assign({}, libraryBTree);
	myProject.resources = undefined;
	const libraryFormatter = new LibraryFormatter();
	sinon.stub(libraryFormatter, "dirExists").resolves(true);
	return libraryFormatter.validate(myProject).then((oRes) => {
		t.truthy(oRes);
		t.pass();
	});
});

test("LibraryFormatter#validate: second folder does not exist", async (t) => {
	const myProject = Object.assign({}, libraryBTree);
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
	const myProject = Object.assign({}, libraryBTree);
	const libraryFormatter = new LibraryFormatter();
	const dirExists = sinon.stub(libraryFormatter, "dirExists");
	dirExists.onFirstCall().resolves(false);
	dirExists.onSecondCall().resolves(true);

	return libraryFormatter.validate(myProject).catch((error) => {
		t.true(error.message && error.message.startsWith("Could not find source directory of project library.d: "));
		t.pass();
	});
});


test("LibraryFormatter#format: pass through", async (t) => {
	const myProject = Object.assign({}, libraryBTree);
	const libraryFormatter = new LibraryFormatter();
	sinon.stub(libraryFormatter, "validate").resolves();

	return libraryFormatter.format(myProject).then((oRes) => {
		t.falsy(oRes);
		t.pass();
	});
});

test("LibraryFormatter#format: copyright", async (t) => {
	const myProject = Object.assign({}, libraryBTree);
	myProject.metadata.copyright = "mine";
	const libraryFormatter = new LibraryFormatter();
	sinon.stub(libraryFormatter, "validate").resolves();

	return libraryFormatter.format(myProject).then((oRes) => {
		t.falsy(oRes);
		t.pass();
	});
});

test("LibraryFormatter#format: no dot library files", async (t) => {
	const myProject = Object.assign({}, libraryBTree);
	myProject.metadata.copyright = false;
	myProject.path = myProject.path + "non-existing";
	const libraryFormatter = new LibraryFormatter();
	sinon.stub(libraryFormatter, "validate").resolves();
	return libraryFormatter.format(myProject).then((oRes) => {
		t.falsy(oRes);
		t.pass();
	});
});

test("LibraryFormatter#format: go through", async (t) => {
	const myProject = Object.assign({}, libraryBTree);
	myProject.metadata.copyright = false;
	const libraryFormatter = new LibraryFormatter();
	sinon.stub(libraryFormatter, "validate").resolves();
	return libraryFormatter.format(myProject).then(() => {
		t.is(myProject.metadata.copyright, "Some fancy copyright");
		t.pass();
	});
});

test("LibraryFormatter#format: configuration test path", async (t) => {
	const myProject = Object.assign({}, libraryBTree);
	myProject.metadata.copyright = false;
	myProject.resources.configuration.paths.test = undefined;
	const libraryFormatter = new LibraryFormatter();
	sinon.stub(libraryFormatter, "validate").resolves();
	return libraryFormatter.format(myProject).then(() => {
		t.is(myProject.metadata.copyright, "Some fancy copyright");
		t.pass();
	});
});
