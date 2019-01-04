const {test} = require("ava");
const path = require("path");
const chai = require("chai");
const sinon = require("sinon");
chai.use(require("chai-fs"));

const ApplicationFormatter = require("../../../../lib/types/application/ApplicationFormatter");

const applicationBPath = path.join(__dirname, "..", "..", "..", "fixtures", "application.b");
const applicationBTree = {
	"id": "application.b",
	"version": "1.0.0",
	"path": applicationBPath,
	"dependencies": [
		{
			"id": "library.d",
			"version": "1.0.0",
			"path": path.join(applicationBPath, "node_modules", "library.d"),
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
		},
		{
			"id": "library.a",
			"version": "1.0.0",
			"path": path.join(applicationBPath, "node_modules", "collection", "library.a"),
			"dependencies": [],
			"_level": 1,
			"specVersion": "0.1",
			"type": "library",
			"metadata": {
				"name": "library.a",
				"copyright": "${copyright}"
			},
			"resources": {
				"configuration": {
					"paths": {
						"src": "src",
						"test": "test"
					}
				},
				"pathMappings": {
					"/resources/": "src",
					"/test-resources/": "test"
				}
			}
		},
		{
			"id": "library.b",
			"version": "1.0.0",
			"path": path.join(applicationBPath, "node_modules", "collection", "library.b"),
			"dependencies": [],
			"_level": 1,
			"specVersion": "0.1",
			"type": "library",
			"metadata": {
				"name": "library.b",
				"copyright": "${copyright}"
			},
			"resources": {
				"configuration": {
					"paths": {
						"src": "src",
						"test": "test"
					}
				},
				"pathMappings": {
					"/resources/": "src",
					"/test-resources/": "test"
				}
			}
		},
		{
			"id": "library.c",
			"version": "1.0.0",
			"path": path.join(applicationBPath, "node_modules", "collection", "library.c"),
			"dependencies": [],
			"_level": 1,
			"specVersion": "0.1",
			"type": "library",
			"metadata": {
				"name": "library.c",
				"copyright": "${copyright}"
			},
			"resources": {
				"configuration": {
					"paths": {
						"src": "src",
						"test": "test"
					}
				},
				"pathMappings": {
					"/resources/": "src",
					"/test-resources/": "test"
				}
			}
		}
	],
	"builder": {
		"bundles": [{
			"bundleDefinition": {
				"name": "application/h/sectionsA/customBundle.js",
				"defaultFileTypes": [".js"],
				"sections": [{
					"mode": "preload",
					"filters": [
						"application/h/sectionsA/",
						"!application/h/sectionsA/section2**",
					]
				}],
				"sort": true
			},
			"bundleOptions": {
				"optimize": true,
				"usePredefinedCalls": true
			}
		},
		{
			"bundleDefinition": {
				"name": "application/h/sectionsB/customBundle.js",
				"defaultFileTypes": [".js"],
				"sections": [{
					"mode": "preload",
					"filters": [
						"application/h/sectionsB/"
					]
				}]
			},
			"bundleOptions": {
				"optimize": true,
				"usePredefinedCalls": true
			}
		}],
		"componentPreload": {
			"paths": [
				"application/g/**/Component.js"
			]
		}
	},
	"_level": 0,
	"specVersion": "0.1",
	"type": "application",
	"metadata": {
		"name": "application.b",
		"namespace": "id1"
	},
	"resources": {
		"configuration": {
			"paths": {
				"webapp": "webapp"
			}
		},
		"pathMappings": {
			"/": "webapp"
		}
	}
};

function clone(o) {
	return JSON.parse(JSON.stringify(o));
}


test("validate: not existing directory webapp for c3", async (t) => {
	const myProject = clone(applicationBTree);
	myProject.path = path.join(__dirname, "..", "..", "..", "fixtures", "application.notExisting");
	const applicationFormatter = new ApplicationFormatter();
	const error = await t.throws(applicationFormatter.validate(myProject));
	t.regex(error.message, /^Could not find application directory of project application\.b: /);
});

test("validate: project not defined", async (t) => {
	const applicationFormatter = new ApplicationFormatter();

	// error is thrown because project is not defined (null)
	const error = await t.throws(applicationFormatter.validate(null));
	t.deepEqual(error.message, "Project is undefined");
});

test("validate: empty version", async (t) => {
	const myProject = clone(applicationBTree);
	myProject.version = undefined;
	const applicationFormatter = new ApplicationFormatter();

	// error is thrown because project's version is not defined
	const error = await t.throws(applicationFormatter.validate(myProject));
	t.deepEqual(error.message, "\"version\" is missing for project application.b");
});

test("validate: empty type", async (t) => {
	const myProject = clone(applicationBTree);
	myProject.type = undefined;
	const applicationFormatter = new ApplicationFormatter();

	// error is thrown because project's type is not defined
	const error = await t.throws(applicationFormatter.validate(myProject));
	t.deepEqual(error.message, "\"type\" configuration is missing for project application.b");
});


test("validate: empty metadata", async (t) => {
	const myProject = clone(applicationBTree);
	myProject.metadata = undefined;
	const applicationFormatter = new ApplicationFormatter();

	// error is thrown because project's metadata is not defined
	const error = await t.throws(applicationFormatter.validate(myProject));
	t.deepEqual(error.message, "\"metadata.name\" configuration is missing for project application.b");
});

test("validate: project resources", async (t) => {
	const myProject = clone(applicationBTree);
	myProject.resources = undefined;
	const applicationFormatter = new ApplicationFormatter();

	// error is thrown because project's resources are not defined
	await applicationFormatter.validate(myProject);
	t.deepEqual(myProject.resources.configuration.paths.webapp, "webapp", "default webapp folder is set");
});

test("readManifest: check applicationVersion", async (t) => {
	const myProject = clone(applicationBTree);
	const applicationFormatter = new ApplicationFormatter();
	const oRes = await applicationFormatter.readManifest(myProject);
	t.deepEqual(typeof oRes, "object");
	t.deepEqual(oRes["sap.app"].applicationVersion.version, "1.2.2");
});

function createMockProject() {
	return {
		"resources": {
			"configuration": {
				"paths": {
					"webapp": "webapp"
				}
			}
		},
		"metadata": {
			"name": "projectName"
		}
	};
}

test("format: No 'sap.app' configuration found", async (t) => {
	const applicationFormatter = new ApplicationFormatter();
	const validateStub = sinon.stub(applicationFormatter, "validate").resolves();
	const readManifestStub = sinon.stub(applicationFormatter, "readManifest").resolves({});
	const project = createMockProject();
	// before
	t.falsy(project.metadata.namespace);
	t.falsy(project.resources.pathMappings);
	await applicationFormatter.format(project);
	// after
	t.deepEqual(project.resources.pathMappings["/"], "webapp", "path mappings is set");
	t.falsy(project.metadata.namespace,
		"namespace is falsy since readManifest resolves with an empty object");
	validateStub.restore();
	readManifestStub.restore();
});

test("format: No application id in 'sap.app' configuration found", async (t) => {
	const applicationFormatter = new ApplicationFormatter();
	const validateStub = sinon.stub(applicationFormatter, "validate").resolves();
	const readManifestStub = sinon.stub(applicationFormatter, "readManifest").resolves({"sap.app": {}});
	const project = createMockProject();
	// before
	t.falsy(project.metadata.namespace);
	t.falsy(project.resources.pathMappings);
	await applicationFormatter.format(project);
	// after
	t.deepEqual(project.resources.pathMappings["/"], "webapp", "path mappings is set");
	t.falsy(project.metadata.namespace,
		"namespace is falsy since readManifest resolves with an empty object");
	validateStub.restore();
	readManifestStub.restore();
});

test("format: set namespace to id", async (t) => {
	const applicationFormatter = new ApplicationFormatter();
	const validateStub = sinon.stub(applicationFormatter, "validate").resolves();
	const readManifestStub = sinon.stub(applicationFormatter, "readManifest").resolves({"sap.app": {"id": "my.id"}});
	const project = createMockProject();
	// before
	t.falsy(project.metadata.namespace);
	await applicationFormatter.format(project);
	// after
	t.deepEqual(project.metadata.namespace, "my/id",
		"namespace was successfully set since readManifest provides the correct object structure");
	validateStub.restore();
	readManifestStub.restore();
});
