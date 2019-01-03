const {test} = require("ava");
const path = require("path");
const chai = require("chai");
const sinon = require("sinon");
chai.use(require("chai-fs"));

const ModuleFormatter = require("../../../../lib/types/module/ModuleFormatter");

function clone(o) {
	return JSON.parse(JSON.stringify(o));
}

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

test("validate: pass through", async (t) => {
	const myProject = clone(libraryBTree);
	const moduleFormatter = new ModuleFormatter();
	const dirExistsStub = sinon.stub(moduleFormatter, "dirExists").resolves(true);
	// for each resources.configuration.paths ("src" and "test") add undefined to the array
	return moduleFormatter.validate(myProject).then((oRes) => {
		t.true(Array.isArray(oRes));
		t.is(oRes.length, 2, "2 entries expected, one for 'src' and one for 'test'");
		dirExistsStub.restore();
		t.pass();
	});
});

test("validate: project not defined", async (t) => {
	const moduleFormatter = new ModuleFormatter();
	return moduleFormatter.validate(null).catch((error) => {
		t.is(error.message, "Project is undefined", "project is null hence an error should be thrown");
		t.pass();
	});
});

test("validate: empty version", async (t) => {
	const myProject = clone(libraryBTree);
	myProject.version = undefined;
	const applicationFormatter = new ModuleFormatter();
	return applicationFormatter.validate(myProject).catch((error) => {
		t.is(error.message, "\"version\" is missing for project library.d");
		t.pass();
	});
});

test("validate: empty type", async (t) => {
	const myProject = clone(libraryBTree);
	myProject.type = undefined;
	const applicationFormatter = new ModuleFormatter();
	return applicationFormatter.validate(myProject).catch((error) => {
		t.is(error.message, "\"type\" configuration is missing for project library.d");
		t.pass();
	});
});


test("validate: empty metadata", async (t) => {
	const myProject = clone(libraryBTree);
	myProject.metadata = undefined;
	const applicationFormatter = new ModuleFormatter();
	return applicationFormatter.validate(myProject).catch((error) => {
		t.is(error.message, "\"metadata.name\" configuration is missing for project library.d");
		t.pass();
	});
});

test("validate: empty resources", async (t) => {
	const myProject = clone(libraryBTree);
	myProject.resources = undefined;
	const moduleFormatter = new ModuleFormatter();
	const dirExistsStub = sinon.stub(moduleFormatter, "dirExists").resolves(true);

	// dirExists resolves with true
	return moduleFormatter.validate(myProject).then((oRes) => {
		t.truthy(oRes);
		dirExistsStub.restore();
		t.pass();
	});
});


test("validate: folder does not exist", async (t) => {
	const myProject = clone(libraryBTree);
	const moduleFormatter = new ModuleFormatter();
	const dirExistsStub = sinon.stub(moduleFormatter, "dirExists").resolves(false);

	// dirExists resolves with false
	return moduleFormatter.validate(myProject).catch((error) => {
		t.true(error.message && error.message.startsWith("Could not find root directory of project library.d: "));
		dirExistsStub.restore();
		t.pass();
	});
});


test("format: pass through", async (t) => {
	const myProject = clone(libraryBTree);
	const moduleFormatter = new ModuleFormatter();
	const validateStub = sinon.stub(moduleFormatter, "validate").resolves();

	// before
	t.deepEqual(myProject.resources.pathMappings, {
		"/resources/": "main/src",
		"/test-resources/": "main/test"
	});
	return moduleFormatter.format(myProject).then((oRes) => {
		// after
		t.deepEqual(myProject.resources.pathMappings, {
			src: "main/src",
			test: "main/test",
		}, "path mappings are overridden with configuration paths");
		validateStub.restore();
		t.pass();
	});
});

test("format: empty configuration paths", async (t) => {
	const myProject = clone(libraryBTree);
	myProject.resources.configuration.paths = undefined;
	const moduleFormatter = new ModuleFormatter();
	const validateStub = sinon.stub(moduleFormatter, "validate").resolves();

	// before
	t.deepEqual(myProject.resources.pathMappings, {
		"/resources/": "main/src",
		"/test-resources/": "main/test"
	});
	return moduleFormatter.format(myProject).then(() => {
		// after
		t.falsy(myProject.resources.pathMappings,
			"path mappings are overridden with undefined since configuration paths are undefined");
		validateStub.restore();
		t.pass();
	});
});
