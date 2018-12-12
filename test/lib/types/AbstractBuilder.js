const {test} = require("ava");
const path = require("path");
const chai = require("chai");
chai.use(require("chai-fs"));

const groupLogger = require("@ui5/logger").getGroupLogger("mygroup");

const AbstractBuilder = require("../../../lib/types/AbstractBuilder");


test("Instantiate AbstractBuilder", (t) => {
	const error = t.throws(() => {
		new AbstractBuilder({});
	}, TypeError);
	t.is(error.message, "Class 'AbstractBuilder' is abstract");
});


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
	"builder": {},
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

class CustomBuilderNoStandardTasks extends AbstractBuilder {
	constructor(project = applicationBTree) {
		super({parentLogger: groupLogger, project});
	}
}

test("addStandardTasks not overwritten", (t) => {
	const error = t.throws(() => {
		new CustomBuilderNoStandardTasks();
	}, Error);
	t.is(error.message, "Function 'addStandardTasks' is not implemented");
});


class CustomBuilder extends CustomBuilderNoStandardTasks {
	constructor(project = applicationBTree) {
		super(project);
	}

	addStandardTasks({resourceCollections, project}) {
		this.addTask("myStandardTask", function() {});
		this.addTask("createDebugFiles", function() {});
		this.addTask("replaceVersion", function() {});
	}
}


test("Add duplicate Task", (t) => {
	const customBuilder = new CustomBuilder();
	const myFunction = function() {};
	customBuilder.addTask("myTask", myFunction);
	const error = t.throws(() => {
		customBuilder.addTask("myTask", myFunction);
	}, Error);
	t.is(error.message, "Failed to add duplicate task myTask for project application.b");
});


test("Custom Tasks No name", (t) => {
	const myProject = Object.assign({}, applicationBTree);
	myProject.builder = {
		"customTasks": [{
			"name": ""
		}]
	};
	const error = t.throws(() => {
		new CustomBuilder( myProject);
	}, Error);
	t.is(error.message, "Missing name for custom task definition of project application.b at index 0");
});

test("Custom Tasks No beforeTask nor afterTask", (t) => {
	const myProject = Object.assign({}, applicationBTree);
	myProject.builder = {
		"customTasks": [{
			"name": "myTask"
		}]
	};
	const error = t.throws(() => {
		new CustomBuilder( myProject);
	}, Error);
	t.is(error.message, "Custom task definition myTask of project application.b defines " +
		"neither a \"beforeTask\" nor an \"afterTask\" parameter. One must be defined.");
});

test("Custom Tasks both beforeTask and afterTask", (t) => {
	const myProject = Object.assign({}, applicationBTree);
	myProject.builder = {
		"customTasks": [{
			"name": "myTask",
			"beforeTask": "myTaskB",
			"afterTask": "myTaskA",
		}]
	};
	const error = t.throws(() => {
		new CustomBuilder( myProject);
	}, Error);
	t.is(error.message, "Custom task definition myTask of project application.b defines " +
		"both \"beforeTask\" and \"afterTask\" parameters. Only one must be defined.");
});

test("Custom Tasks beforeTask not existing", (t) => {
	const myProject = Object.assign({}, applicationBTree);
	myProject.builder = {
		"customTasks": [{
			"name": "myTask",
			"beforeTask": "not-existing"
		}]
	};
	const error = t.throws(() => {
		new CustomBuilder( myProject);
	}, Error);
	t.is(error.message, "taskRepository: Unknown Task myTask");
});


test("Custom Tasks beforeTask not existing", (t) => {
	const myProject = Object.assign({}, applicationBTree);
	myProject.builder = {
		"customTasks": [{
			"name": "uglify",
			"beforeTask": "not-existing"
		}]
	};
	const error = t.throws(() => {
		new CustomBuilder( myProject);
	}, Error);
	t.is(error.message, "Could not find task not-existing, referenced by custom task uglify, " +
		"to be scheduled for project application.b");
});


test("Custom Tasks beforeTask existing", (t) => {
	const myProject = Object.assign({}, applicationBTree);
	myProject.builder = {
		"customTasks": [{
			"name": "buildThemes",
			"beforeTask": "uglify"
		}]
	};
	const error = t.throws(() => {
		new CustomBuilder( myProject);
	}, Error);
	t.is(error.message, "Could not find task uglify, referenced by custom task buildThemes, " +
		"to be scheduled for project application.b");
});


test("Custom Tasks beforeTask existing myStandardTask", (t) => {
	const myProject = Object.assign({}, applicationBTree);
	myProject.builder = {
		"customTasks": [{
			"name": "createDebugFiles",
			"beforeTask": "replaceVersion"
		}]
	};
	const customBuilder = new CustomBuilder( myProject);
	t.truthy(customBuilder, "custom builder can be created");
});
