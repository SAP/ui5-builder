const {test} = require("ava");
const path = require("path");
const chai = require("chai");
const sinon = require("sinon");
chai.use(require("chai-fs"));

const ModuleFormatter = require("../../../../lib/types/module/ModuleFormatter");

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

test("ModuleFormatter#validate: run through", async (t) => {
	const myProject = Object.assign({}, libraryBTree);
	const moduleFormatter = new ModuleFormatter();
	sinon.stub(moduleFormatter, "dirExists").resolves(true);
	return moduleFormatter.validate(myProject).then((oRes) => {
		t.truthy(oRes);
		t.pass();
	});
});

test("ModuleFormatter#validate: project not defined", async (t) => {
	const moduleFormatter = new ModuleFormatter();
	return moduleFormatter.validate(null).catch((error) => {
		t.is(error.message, "Project is undefined");
		t.pass();
	});
});

test("ApplicationFormatter#validate: empty version", async (t) => {
	const myProject = Object.assign({}, libraryBTree);
	myProject.version = undefined;
	const applicationFormatter = new ModuleFormatter();
	return applicationFormatter.validate(myProject).catch((error) => {
		t.is(error.message, "\"version\" is missing for project library.d");
		t.pass();
	});
});

test("ApplicationFormatter#validate: empty type", async (t) => {
	const myProject = Object.assign({}, libraryBTree);
	myProject.type = undefined;
	const applicationFormatter = new ModuleFormatter();
	return applicationFormatter.validate(myProject).catch((error) => {
		t.is(error.message, "\"type\" configuration is missing for project library.d");
		t.pass();
	});
});


test("ApplicationFormatter#validate: metadata", async (t) => {
	const myProject = Object.assign({}, libraryBTree);
	myProject.metadata = undefined;
	const applicationFormatter = new ModuleFormatter();
	return applicationFormatter.validate(myProject).catch((error) => {
		t.is(error.message, "\"metadata.name\" configuration is missing for project library.d");
		t.pass();
	});
});

test("ModuleFormatter#validate: resources", async (t) => {
	const myProject = Object.assign({}, libraryBTree);
	myProject.resources = undefined;
	const moduleFormatter = new ModuleFormatter();
	sinon.stub(moduleFormatter, "dirExists").resolves(true);
	return moduleFormatter.validate(myProject).then((oRes) => {
		t.truthy(oRes);
		t.pass();
	});
});

test("ModuleFormatter#validate: folder does exist", async (t) => {
	const myProject = Object.assign({}, libraryBTree);
	const moduleFormatter = new ModuleFormatter();
	const dirExists = sinon.stub(moduleFormatter, "dirExists");
	dirExists.resolves(true);

	return moduleFormatter.validate(myProject).then((oRes) => {
		t.truthy(oRes);
		t.pass();
	});
});

test("ModuleFormatter#validate: folder does not exist", async (t) => {
	const myProject = Object.assign({}, libraryBTree);
	const moduleFormatter = new ModuleFormatter();
	const dirExists = sinon.stub(moduleFormatter, "dirExists");
	dirExists.resolves(false);

	return moduleFormatter.validate(myProject).catch((error) => {
		t.true(error.message && error.message.startsWith("Could not find root directory of project library.d: "));
		t.pass();
	});
});


test("ModuleFormatter#format: pass through", async (t) => {
	const myProject = Object.assign({}, libraryBTree);
	const moduleFormatter = new ModuleFormatter();
	sinon.stub(moduleFormatter, "validate").resolves();

	return moduleFormatter.format(myProject).then((oRes) => {
		t.falsy(oRes);
		t.pass();
	});
});

test("ModuleFormatter#format: configuration test path", async (t) => {
	const myProject = Object.assign({}, libraryBTree);
	myProject.metadata.copyright = false;
	myProject.resources.configuration.paths = undefined;
	const moduleFormatter = new ModuleFormatter();
	sinon.stub(moduleFormatter, "validate").resolves();
	return moduleFormatter.format(myProject).then((oRes) => {
		t.falsy(oRes);
		t.pass();
	});
});
