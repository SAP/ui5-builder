const {test} = require("ava");
const path = require("path");
const chai = require("chai");
const sinon = require("sinon");
const assert = require("assert");
chai.use(require("chai-fs"));

const ApplicationFormatter = require("../../../../lib/types/application/ApplicationFormatter");

const applicationBPath = path.join(__dirname, "..", "..", "..", "fixtures", "application.c3");
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


test("ApplicationFormatter#validate: not existing directory webapp for c3", async (t) => {
	const myProject = Object.assign({}, applicationBTree);
	const applicationFormatter = new ApplicationFormatter();
	return applicationFormatter.validate(myProject).catch((error) => {
		t.true(error.message && error.message.startsWith("Could not find application directory " +
			"of project application.b: "));
		t.pass();
	});
});

test("ApplicationFormatter#validate: project not defined", async (t) => {
	const applicationFormatter = new ApplicationFormatter();
	return applicationFormatter.validate(null).catch((error) => {
		t.is(error.message, "Project is undefined");
		t.pass();
	});
});

test("ApplicationFormatter#validate: empty version", async (t) => {
	const myProject = Object.assign({}, applicationBTree);
	myProject.version = undefined;
	const applicationFormatter = new ApplicationFormatter();
	return applicationFormatter.validate(myProject).catch((error) => {
		t.is(error.message, "\"version\" is missing for project application.b");
		t.pass();
	});
});

test("ApplicationFormatter#validate: empty type", async (t) => {
	const myProject = Object.assign({}, applicationBTree);
	myProject.type = undefined;
	const applicationFormatter = new ApplicationFormatter();
	return applicationFormatter.validate(myProject).catch((error) => {
		t.is(error.message, "\"type\" configuration is missing for project application.b");
		t.pass();
	});
});


test("ApplicationFormatter#validate: metadata", async (t) => {
	const myProject = Object.assign({}, applicationBTree);
	myProject.metadata = undefined;
	const applicationFormatter = new ApplicationFormatter();
	return applicationFormatter.validate(myProject).catch((error) => {
		t.is(error.message, "\"metadata.name\" configuration is missing for project application.b");
		t.pass();
	});
});

test("ApplicationFormatter#validate: project resources", async (t) => {
	const myProject = Object.assign({}, applicationBTree);
	myProject.resources = undefined;
	const applicationFormatter = new ApplicationFormatter();
	return applicationFormatter.validate(myProject).catch((error) => {
		assert.ok(error.message && error.message.startsWith("Could not find application directory " +
			"of project application.b: "));
		t.pass();
	});
});

test("ApplicationFormatter#readManifest: check json", async (t) => {
	const myProject = Object.assign({}, applicationBTree);
	myProject.path = path.join(__dirname, "..", "..", "..", "fixtures", "application.d");
	const applicationFormatter = new ApplicationFormatter();
	return applicationFormatter.readManifest(myProject).then((oRes) => {
		t.is(typeof oRes, "object");
		t.pass();
	});
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
			"name": "projectname"
		}
	};
}

test("ApplicationFormatter#format: readManifest fail", async (t) => {
	const applicationFormatter = new ApplicationFormatter();
	sinon.stub(applicationFormatter, "validate").resolves();
	sinon.stub(applicationFormatter, "readManifest").rejects();
	const project = createMockProject();
	return applicationFormatter.format(project).then((oRes) => {
		t.falsy(oRes);
		t.pass();
	});
});

test("ApplicationFormatter#format: No 'sap.app' configuration found", async (t) => {
	const applicationFormatter = new ApplicationFormatter();
	sinon.stub(applicationFormatter, "validate").resolves();
	sinon.stub(applicationFormatter, "readManifest").resolves({});
	const project = createMockProject();
	return applicationFormatter.format(project).then((oRes) => {
		t.is(project.resources.pathMappings["/"], "webapp");
		t.falsy(oRes);
		t.pass();
	});
});

test("ApplicationFormatter#format: No application id found", async (t) => {
	const applicationFormatter = new ApplicationFormatter();
	sinon.stub(applicationFormatter, "validate").resolves();
	sinon.stub(applicationFormatter, "readManifest").resolves({"sap.app": {}});
	const project = createMockProject();
	return applicationFormatter.format(project).then((oRes) => {
		t.falsy(oRes);
		t.pass();
	});
});

test("ApplicationFormatter#format: replace id", async (t) => {
	const applicationFormatter = new ApplicationFormatter();
	sinon.stub(applicationFormatter, "validate").resolves();
	sinon.stub(applicationFormatter, "readManifest").resolves({"sap.app": {"id": "my.id"}});
	const project = createMockProject();
	return applicationFormatter.format(project).then((oRes) => {
		t.falsy(oRes);
		t.is(project.metadata.namespace, "my/id");
		t.pass();
	});
});

