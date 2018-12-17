const {test} = require("ava");
const chai = require("chai");
const path = require("path");
chai.use(require("chai-fs"));

const groupLogger = require("@ui5/logger").getGroupLogger("mygroup");

const ModuleFormatter = require("../../../../lib/types/module/ModuleFormatter");


const applicationBPath = path.join(__dirname, "..", "..", "..", "fixtures", "application.b");
const applicationBTree = {
	"id": "application.b",
	"version": "1.0.0",
	"path": applicationBPath,
	"dependencies": [],
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
		}],
		"componentPreload": {
			"paths": [
				"application/g/**/Component.js"
			]
		}
	},
	"_level": 0,
	"specVersion": "0.1",
	"type": "module",
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

test("ModuleBuilder instantiation", (t) => {
	const appBuilder = new ModuleFormatter({parentLogger: groupLogger, project: applicationBTree});
	t.truthy(appBuilder);
});
