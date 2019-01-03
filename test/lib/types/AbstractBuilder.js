const {test} = require("ava");
const path = require("path");
const chai = require("chai");
chai.use(require("chai-fs"));

const parentLogger = require("@ui5/logger").getGroupLogger("mygroup");

const AbstractBuilder = require("../../../lib/types/AbstractBuilder");


function clone(o) {
	return JSON.parse(JSON.stringify(o));
}

const applicationBPath = path.join(__dirname, "..", "..", "..", "fixtures", "application.b");
const applicationBTree = {
	"id": "application.b",
	"version": "1.0.0",
	"path": applicationBPath,
	"dependencies": [],
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


test("Instantiation of AbstractBuilder", (t) => {
	const error = t.throws(() => {
		new AbstractBuilder({});
	}, TypeError, "abstract builder cannot be instantiated since it is abstract");
	t.is(error.message, "Class 'AbstractBuilder' is abstract");
});

class CustomBuilderWithoutStandardTasks extends AbstractBuilder {
	constructor(project = applicationBTree) {
		super({parentLogger, project});
	}
}

test("Instantiation of class with addStandardTasks not overwritten", (t) => {
	const error = t.throws(() => {
		new CustomBuilderWithoutStandardTasks();
	}, Error, "Has to implement 'addStandardTasks'");
	t.is(error.message, "Function 'addStandardTasks' is not implemented");
});


class CustomBuilder extends CustomBuilderWithoutStandardTasks {
	constructor(project = applicationBTree) {
		super(project);
	}

	addStandardTasks({resourceCollections, project}) {
		this.addTask("myStandardTask", function() {});
		this.addTask("createDebugFiles", function() {});
		this.addTask("replaceVersion", function() {});
	}
}


test("addTask: Add duplicate Task", (t) => {
	const customBuilder = new CustomBuilder();
	const myFunction = function() {};
	customBuilder.addTask("myTask", myFunction);
	const error = t.throws(() => {
		customBuilder.addTask("myTask", myFunction);
	}, Error);
	t.is(error.message, "Failed to add duplicate task myTask for project application.b");
});


test("Instantiation with custom task without a name", (t) => {
	const myProject = clone(applicationBTree);
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

test("Instantiation with custom task with neither beforeTask nor afterTask", (t) => {
	const myProject = clone(applicationBTree);
	myProject.builder = {
		"customTasks": [{
			"name": "myTask"
		}]
	};
	const error = t.throws(() => {
		new CustomBuilder(myProject);
	}, Error);
	t.is(error.message, "Custom task definition myTask of project application.b defines " +
		"neither a \"beforeTask\" nor an \"afterTask\" parameter. One must be defined.");
});

test("Instantiation with custom task with both: beforeTask and afterTask", (t) => {
	const myProject = clone(applicationBTree);
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

test("Instantiation with custom task and task does not exist", (t) => {
	const myProject = clone(applicationBTree);
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

test("Instantiation with custom task and beforeTask does not exist", (t) => {
	const myProject = clone(applicationBTree);
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


test("Instantiation with custom task", (t) => {
	const myProject = clone(applicationBTree);
	myProject.builder = {
		"customTasks": [{
			"name": "createDebugFiles",
			"beforeTask": "replaceVersion"
		}]
	};
	const customBuilder = new CustomBuilder(myProject);
	t.truthy(customBuilder, "custom builder can be created");
	t.deepEqual(Object.keys(customBuilder.tasks),
		["myStandardTask", "createDebugFiles", "replaceVersion", "createDebugFiles--1"]);
});
