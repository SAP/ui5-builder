const {test} = require("ava");
const chai = require("chai");
const path = require("path");
chai.use(require("chai-fs"));

const groupLogger = require("@ui5/logger").getGroupLogger("mygroup");

const ApplicationBuilder = require("../../../../lib/types/application/ApplicationBuilder");


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

test("type retrieval", (t) => {
	const appBuilder = new ApplicationBuilder({parentLogger: groupLogger, project: applicationBTree});
	t.truthy(appBuilder);
});
