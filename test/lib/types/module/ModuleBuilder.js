const {test} = require("ava");
const chai = require("chai");
const path = require("path");
chai.use(require("chai-fs"));

const parentLogger = require("@ui5/logger").getGroupLogger("mygroup");

const ModuleBuilder = require("../../../../lib/types/module/ModuleBuilder");

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

test("Instantiation without tasks", (t) => {
	const project = clone(applicationBTree);
	const appBuilder = new ModuleBuilder({parentLogger, project});
	t.truthy(appBuilder);
	t.deepEqual(appBuilder.tasks, {}, "There are no tasks in the project structure");
});


test("Instantiation with customTasks will always fail", (t) => {
	const project = clone(applicationBTree);
	project.builder.customTasks = [
		{name: "replaceVersion", afterTask: "uglify"},
		{name: "uglify", beforeTask: "replaceVersion"}
	];
	// will throw an error since custom tasks require a before/afterTask which needs to be present as part of the tasks
	const error = t.throws(() => {
		new ModuleBuilder({parentLogger, project});
	});

	t.is(error.message, "Could not find task uglify, referenced by custom task replaceVersion, " +
		"to be scheduled for project application.b");
});

test("addTask", (t) => {
	const project = clone(applicationBTree);
	const appBuilder = new ModuleBuilder({parentLogger, project});
	const replaceVersion2 = function() {};
	appBuilder.addTask("replaceVersion2", replaceVersion2);
	t.deepEqual(appBuilder.tasks, {replaceVersion2}, "There should now be one task");
});
