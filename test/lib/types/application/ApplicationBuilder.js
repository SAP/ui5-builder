const {test} = require("ava");
const chai = require("chai");
const path = require("path");
chai.use(require("chai-fs"));

const parentLogger = require("@ui5/logger").getGroupLogger("mygroup");

const ApplicationBuilder = require("../../../../lib/types/application/ApplicationBuilder");


function clone(o) {
	return JSON.parse(JSON.stringify(o));
}

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
	"specVersion": "0.1",
	"type": "application",
	"metadata": {
		"name": "application.b",
		"namespace": "id1"
	}
};

test("Instantiation", (t) => {
	const project = clone(applicationBTree);
	const appBuilder = new ApplicationBuilder({parentLogger, project});
	t.truthy(appBuilder);
	t.is(Object.keys(appBuilder.tasks).length, 10, "ApplicationBuilder is instantiated with 10 initial tasks");
});

test("Instantiation without component preload", (t) => {
	const project = clone(applicationBTree);
	project.builder.componentPreload = undefined;
	const appBuilder = new ApplicationBuilder({parentLogger, project});
	t.truthy(appBuilder);
	t.is(Object.keys(appBuilder.tasks).length, 10, "ApplicationBuilder is still instantiated with 10 initial tasks");
});

test("Instantiation with custom tasks", (t) => {
	const project = clone(applicationBTree);
	project.builder.customTasks = [
		{name: "replaceVersion", afterTask: "uglify"},
		{name: "uglify", beforeTask: "replaceVersion"}
	];
	const appBuilder = new ApplicationBuilder({parentLogger, project});
	t.truthy(appBuilder);
	t.is(Object.keys(appBuilder.tasks).length, 12,
		"ApplicationBuilder is instantiated with 10 initial and 2 custom tasks");
});
