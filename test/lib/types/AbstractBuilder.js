const test = require("ava");
const path = require("path");
const chai = require("chai");
chai.use(require("chai-fs"));
const sinon = require("sinon");

test.afterEach.always((t) => {
	sinon.restore();
});

const taskRepository = require("../../../lib/tasks/taskRepository");
const parentLogger = require("@ui5/logger").getGroupLogger("mygroup");

const AbstractBuilder = require("../../../lib/types/AbstractBuilder");


function clone(o) {
	return JSON.parse(JSON.stringify(o));
}

const applicationBPath = path.join(__dirname, "..", "..", "..", "fixtures", "application.b");
const applicationBTree = {
	id: "application.b",
	version: "1.0.0",
	path: applicationBPath,
	dependencies: [],
	builder: {},
	_level: 0,
	_isRoot: true,
	specVersion: "0.1",
	type: "application",
	metadata: {
		name: "application.b",
		namespace: "application/b"
	},
	resources: {
		configuration: {
			paths: {
				webapp: "webapp"
			}
		}
	}
};

test("Instantiation of AbstractBuilder", (t) => {
	const project = clone(applicationBTree);
	t.throws(() => {
		new AbstractBuilder({project});
	}, {
		instanceOf: TypeError,
		message: "Class 'AbstractBuilder' is abstract"
	});
});

class CustomBuilderWithoutStandardTasks extends AbstractBuilder {
	constructor({project}) {
		super({parentLogger, project});
	}
}

test("Instantiation of class with addStandardTasks not overwritten", (t) => {
	const project = clone(applicationBTree);
	t.throws(() => {
		new CustomBuilderWithoutStandardTasks({project});
	}, {message: "Function 'addStandardTasks' is not implemented"});
});

class CustomBuilder extends AbstractBuilder {
	constructor({project, resourceCollections, taskUtil}) {
		super({parentLogger, project, resourceCollections, taskUtil});
	}

	addStandardTasks({resourceCollections, project}) {
		this.addTask("myStandardTask", function() {});
		this.addTask("createDebugFiles", function() {});
		this.addTask("replaceVersion", function() {});
	}
}

class EmptyBuilder extends AbstractBuilder {
	constructor({project, resourceCollections, taskUtil}) {
		super({parentLogger, project, resourceCollections, taskUtil});
	}

	addStandardTasks({resourceCollections, project}) {
		// None - like the ModuleBuilder
	}
}

test("Instantiation with standard tasks only", (t) => {
	const project = clone(applicationBTree);

	const customBuilder = new CustomBuilder({project});
	t.deepEqual(customBuilder.taskExecutions, {
		"myStandardTask": ["myStandardTask"], "createDebugFiles": ["createDebugFiles"],
		"replaceVersion": ["replaceVersion"]
	}, "Task executions are correct");
	t.deepEqual(customBuilder.taskExecutionOrder,
		["myStandardTask", "createDebugFiles", "replaceVersion"],
		"Order of tasks is correct");
	t.deepEqual(customBuilder.project.id, "application.b", "Project correctly set");
});

test("Instantiation with custom task without a name", (t) => {
	const project = clone(applicationBTree);
	project.builder = {
		customTasks: [{
			name: ""
		}]
	};
	const error = t.throws(() => {
		new CustomBuilder({project});
	});
	t.deepEqual(error.message, "Missing name for custom task definition of project application.b at index 0",
		"Correct exception thrown");
});

test("Instantiation with custom task with neither beforeTask nor afterTask", (t) => {
	const project = clone(applicationBTree);
	project.builder = {
		customTasks: [{
			name: "myTask"
		}]
	};
	const error = t.throws(() => {
		new CustomBuilder({project});
	});
	t.deepEqual(error.message, `Custom task definition myTask of project application.b defines ` +
		`neither a "beforeTask" nor an "afterTask" parameter. One must be defined.`, "Correct exception thrown");
});

test("Instantiation with custom task with both: beforeTask and afterTask", (t) => {
	const project = clone(applicationBTree);
	project.builder = {
		customTasks: [{
			name: "myTask",
			beforeTask: "myTaskB",
			afterTask: "myTaskA",
		}]
	};
	const error = t.throws(() => {
		new CustomBuilder({project});
	});
	t.deepEqual(error.message, `Custom task definition myTask of project application.b defines ` +
		`both "beforeTask" and "afterTask" parameters. Only one must be defined.`, "Correct exception thrown");
});

test("Instantiation with custom task that is unknown", (t) => {
	const project = clone(applicationBTree);
	project.builder = {
		customTasks: [{
			name: "myTask",
			beforeTask: "myOtherTask"
		}]
	};
	const error = t.throws(() => {
		new CustomBuilder({project});
	});
	t.deepEqual(error.message, "taskRepository: Unknown Task myTask", "Correct exception thrown");
});

test("Instantiation with custom task and unknown beforeTask", (t) => {
	const project = clone(applicationBTree);
	project.builder = {
		customTasks: [{
			name: "uglify",
			beforeTask: "someTask"
		}]
	};
	const error = t.throws(() => {
		new CustomBuilder({project});
	});
	t.deepEqual(error.message, "Could not find task someTask, referenced by custom task uglify, " +
		"to be scheduled for project application.b", "Correct exception thrown");
});

test.serial("Instantiation with custom task", (t) => {
	sinon.stub(taskRepository, "getTask").returns({
		task: function() {},
		specVersion: undefined
	});

	const project = clone(applicationBTree);
	project.builder = {
		customTasks: [{
			name: "myTask",
			beforeTask: "replaceVersion"
		}]
	};
	const customBuilder = new CustomBuilder({project});
	t.truthy(customBuilder.tasks["myTask"], "Custom task has been added to task array");
	t.deepEqual(customBuilder.taskExecutions, {
		"myStandardTask": ["myStandardTask"], "createDebugFiles": ["createDebugFiles"],
		"myTask": ["myTask"], "replaceVersion": ["replaceVersion"]
	}, "Task executions are correct");
	t.deepEqual(customBuilder.taskExecutionOrder,
		["myStandardTask", "createDebugFiles", "myTask", "replaceVersion"],
		"Order of tasks is correct");
});

test.serial("Instantiation of empty builder with custom tasks", (t) => {
	sinon.stub(taskRepository, "getTask").returns({
		task: function() {},
		specVersion: undefined
	});

	const project = clone(applicationBTree);
	project.builder = {
		customTasks: [{
			name: "myTask"
		}, {
			name: "myTask2",
			beforeTask: "myTask"
		}]
	};
	const customBuilder = new EmptyBuilder({project});
	t.truthy(customBuilder.tasks["myTask"], "Custom task has been added to task array");
	t.truthy(customBuilder.tasks["myTask2"], "Custom task 2 has been added to task array");
	t.deepEqual(customBuilder.taskExecutions, {
		"myTask": ["myTask"], "myTask2": ["myTask2"]
	}, "Task executions are correct");
	t.deepEqual(customBuilder.taskExecutionOrder,
		["myTask2", "myTask"],
		"Order of tasks is correct");
});

test.serial("Instantiation of empty builder with 2nd custom tasks defining neither beforeTask nor afterTask", (t) => {
	sinon.stub(taskRepository, "getTask").returns({
		task: function() {},
		specVersion: "2.0"
	});

	const project = clone(applicationBTree);
	project.builder = {
		customTasks: [{
			name: "myTask"
		}, {
			name: "myTask2" // should define before- or afterTask
		}]
	};
	const error = t.throws(() => {
		new EmptyBuilder({project});
	});
	t.deepEqual(error.message, `Custom task definition myTask2 of project application.b defines ` +
		`neither a "beforeTask" nor an "afterTask" parameter. One must be defined.`, "Correct exception thrown");
});

test.serial("Instantiation of empty builder with custom task: Custom task called correctly", (t) => {
	const customTaskStub = sinon.stub();
	sinon.stub(taskRepository, "getTask").returns({
		task: customTaskStub,
		specVersion: "2.0"
	});

	const project = clone(applicationBTree);
	project.builder = {
		customTasks: [{
			name: "myTask",
			beforeTask: "replaceVersion",
			configuration: "pony"
		}]
	};
	const resourceCollections = {
		workspace: "myWorkspace",
		dependencies: "myDependencies"
	};
	const getInterfaceStub = sinon.stub().returns(undefined);
	const taskUtil = {
		getInterface: getInterfaceStub
	};
	const customBuilder = new EmptyBuilder({project, resourceCollections, taskUtil});
	customBuilder.tasks["myTask"]();

	t.is(getInterfaceStub.callCount, 1, "taskUtil.getInterface got called once");
	t.deepEqual(getInterfaceStub.getCall(0).args[0], "2.0", "taskUtil.getInterface got called with correct argument");

	t.is(customTaskStub.callCount, 1, "Custom task got called once");
	t.deepEqual(customTaskStub.getCall(0).args[0], {
		options: {
			projectName: "application.b",
			projectNamespace: "application/b",
			configuration: "pony"
		},
		workspace: "myWorkspace",
		dependencies: "myDependencies"
	}, "Custom task got called with expected arguments");
});

test.serial("Instantiation with custom task defined three times", (t) => {
	sinon.stub(taskRepository, "getTask").returns({
		task: function() {},
		specVersion: "2.0"
	});

	const project = clone(applicationBTree);
	project.builder = {
		customTasks: [{
			name: "myTask",
			beforeTask: "myStandardTask"
		}, {
			name: "myTask",
			afterTask: "replaceVersion"
		}, {
			name: "myTask",
			beforeTask: "myStandardTask"
		}]
	};
	const customBuilder = new CustomBuilder({project});
	t.truthy(customBuilder.tasks["myTask"], "Custom task myTask has been added to task array");
	t.truthy(customBuilder.tasks["myTask--1"], "Custom task myTask--1 has been added to task array");
	t.truthy(customBuilder.tasks["myTask--2"], "Custom task myTask--2 has been added to task array");
	t.deepEqual(customBuilder.taskExecutions, {
		"myStandardTask": ["myStandardTask"], "createDebugFiles": ["createDebugFiles"],
		"myTask": ["myTask", "myTask--1", "myTask--2"], "replaceVersion": ["replaceVersion"]
	}, "Task executions are correct");
	t.deepEqual(customBuilder.taskExecutionOrder,
		["myTask", "myTask--2", "myStandardTask", "createDebugFiles", "replaceVersion", "myTask--1"],
		"Order of tasks is correct");
});

test.serial("Instantiation with custom task defined three times with ids", (t) => {
	sinon.stub(taskRepository, "getTask").returns({
		task: function() {},
		specVersion: "2.0"
	});

	const project = clone(applicationBTree);
	project.builder = {
		customTasks: [{
			id: "myTask1",
			name: "myTask",
			beforeTask: "myStandardTask"
		}, {
			id: "myTask2",
			name: "myTask",
			afterTask: "replaceVersion"
		}, {
			id: "myTask3",
			name: "myTask",
			beforeTask: "myStandardTask"
		}]
	};
	const customBuilder = new CustomBuilder({project});
	t.truthy(customBuilder.tasks["myTask1"], "Custom task myTask1 has been added to task array");
	t.truthy(customBuilder.tasks["myTask2"], "Custom task myTask2 has been added to task array");
	t.truthy(customBuilder.tasks["myTask3"], "Custom task myTask3 has been added to task array");
	t.deepEqual(customBuilder.taskExecutions, {
		"myStandardTask": ["myStandardTask"], "createDebugFiles": ["createDebugFiles"],
		"myTask": ["myTask1", "myTask2", "myTask3"], "replaceVersion": ["replaceVersion"]
	}, "Task executions are correct");
	t.deepEqual(customBuilder.taskExecutionOrder,
		["myTask1", "myTask3", "myStandardTask", "createDebugFiles", "replaceVersion", "myTask2"],
		"Order of tasks is correct");
});

test.serial("Instantiation of empty builder with duplicate task ids", (t) => {
	sinon.stub(taskRepository, "getTask").returns({
		task: function() {},
		specVersion: "2.0"
	});

	const project = clone(applicationBTree);
	project.builder = {
		customTasks: [{
			id: "myTask",
			name: "myTask"
		}, {
			id: "myTask",
			name: "myTask",
			afterTask: "myTask"
		}]
	};
	const error = t.throws(() => {
		new EmptyBuilder({project});
	});
	t.deepEqual(error.message, `Conflicting custom task definition myTask of project application.b, more than ` +
		`one task with the same identifier defined. Task identifiers must be unique.`, "Correct exception thrown");
});

test.serial("Instantiation with custom task defined three times: Custom tasks get called correctly", async (t) => {
	const customTaskStub = sinon.stub().returns(Promise.resolve());
	sinon.stub(taskRepository, "getTask").returns({
		task: customTaskStub,
		specVersion: "2.0"
	});

	const project = clone(applicationBTree);
	project.builder = {
		customTasks: [{
			name: "myTask",
			beforeTask: "myStandardTask",
			configuration: "foo"
		}, {
			name: "myTask",
			afterTask: "replaceVersion",
			configuration: "bar"
		}, {
			name: "myTask",
			beforeTask: "myStandardTask",
			configuration: "baz"
		}]
	};

	const resourceCollections = {
		workspace: "myWorkspace",
		dependencies: "myDependencies"
	};
	const getInterfaceStub = sinon.stub().returns(undefined);
	const taskUtil = {
		getInterface: getInterfaceStub
	};
	const customBuilder = new CustomBuilder({project, resourceCollections, taskUtil});
	await customBuilder.build(["myTask"]);

	t.is(getInterfaceStub.callCount, 3, "taskUtil.getInterface got called three times");
	t.is(customTaskStub.callCount, 3, "Custom task got called three times");
	["foo", "baz", "bar"].forEach((configuration, index) => {
		t.deepEqual(customTaskStub.getCall(index).args[0], {
			options: {
				projectName: "application.b",
				projectNamespace: "application/b",
				configuration
			},
			workspace: "myWorkspace",
			dependencies: "myDependencies"
		}, `Custom task invocation ${index} got called with expected options`);
	});
});

test.serial("Instantiation with custom task defined three times: Custom tasks get called in right order", async (t) => {
	const customTaskStub = sinon.stub().returns(Promise.resolve());
	sinon.stub(taskRepository, "getTask").returns({
		task: customTaskStub,
		specVersion: "2.0"
	});

	const project = clone(applicationBTree);
	project.builder = {
		customTasks: [{
			id: "myTaskA",
			name: "myTask",
			beforeTask: "myStandardTask",
			configuration: "foo"
		}, {
			id: "myTaskB",
			name: "myTask",
			afterTask: "myTaskA",
			configuration: "bar"
		}, {
			id: "myTaskC",
			name: "myTask",
			beforeTask: "myTaskA",
			configuration: "baz"
		}]
	};

	const resourceCollections = {
		workspace: "myWorkspace",
		dependencies: "myDependencies"
	};
	const getInterfaceStub = sinon.stub().returns(undefined);
	const taskUtil = {
		getInterface: getInterfaceStub
	};
	const customBuilder = new CustomBuilder({project, resourceCollections, taskUtil});
	await customBuilder.build(["myTask"]);

	t.is(getInterfaceStub.callCount, 3, "taskUtil.getInterface got called three times");
	t.is(customTaskStub.callCount, 3, "Custom task got called three times");
	["baz", "foo", "bar"].forEach((configuration, index) => {
		t.deepEqual(customTaskStub.getCall(index).args[0], {
			options: {
				projectName: "application.b",
				projectNamespace: "application/b",
				configuration
			},
			workspace: "myWorkspace",
			dependencies: "myDependencies"
		}, `Custom task invocation ${index} got called with expected options`);
	});
});

test.serial("Instantiation with multiple custom task defined: Custom tasks respect tasks to run", async (t) => {
	const customTaskAStub = sinon.stub().returns(Promise.resolve());
	const customTaskBStub = sinon.stub().returns(Promise.resolve());
	sinon.replace(taskRepository, "getTask", sinon.fake((taskName) => ({
		task: taskName === "myTaskA" ? customTaskAStub : customTaskBStub,
		specVersion: "2.0"
	})));

	const project = clone(applicationBTree);
	project.builder = {
		customTasks: [{
			name: "myTaskA",
			beforeTask: "myStandardTask",
			configuration: "foo"
		}, {
			name: "myTaskB",
			beforeTask: "myStandardTask",
			configuration: "baz"
		}, {
			name: "myTaskA",
			afterTask: "myTaskA",
			configuration: "bar"
		}, {
			name: "myTaskB",
			beforeTask: "myTaskB",
			configuration: "qux"
		}]
	};

	const resourceCollections = {
		workspace: "myWorkspace",
		dependencies: "myDependencies"
	};
	const getInterfaceStub = sinon.stub().returns(undefined);
	const taskUtil = {
		getInterface: getInterfaceStub
	};
	const customBuilder1 = new CustomBuilder({project, resourceCollections, taskUtil});
	await customBuilder1.build(["myTaskA"]);

	t.is(getInterfaceStub.callCount, 2, "taskUtil.getInterface got called two times");
	t.is(customTaskAStub.callCount, 2, "Custom task A got called two times");
	t.is(customTaskBStub.callCount, 0, "Custom task B got called zero times");
	["foo", "bar"].forEach((configuration, index) => {
		t.deepEqual(customTaskAStub.getCall(index).args[0], {
			options: {
				projectName: "application.b",
				projectNamespace: "application/b",
				configuration
			},
			workspace: "myWorkspace",
			dependencies: "myDependencies"
		}, `Custom task invocation ${index} got called with expected options`);
	});

	const customBuilder2 = new CustomBuilder({project, resourceCollections, taskUtil});
	await customBuilder2.build(["myTaskB"]);

	t.is(getInterfaceStub.callCount, 4, "taskUtil.getInterface got called two more times");
	t.is(customTaskAStub.callCount, 2, "Custom task A didn't get called my more times");
	t.is(customTaskBStub.callCount, 2, "Custom task B got called two times");
	["qux", "baz"].forEach((configuration, index) => {
		t.deepEqual(customTaskBStub.getCall(index).args[0], {
			options: {
				projectName: "application.b",
				projectNamespace: "application/b",
				configuration
			},
			workspace: "myWorkspace",
			dependencies: "myDependencies"
		}, `Custom task invocation ${index} got called with expected options`);
	});
});

test.serial("Instantiation with custom task: Custom task called correctly", (t) => {
	const customTaskStub = sinon.stub();
	sinon.stub(taskRepository, "getTask").returns({
		task: customTaskStub,
		specVersion: "2.0"
	});

	const project = clone(applicationBTree);
	project.builder = {
		customTasks: [{
			name: "myTask",
			beforeTask: "replaceVersion",
			configuration: "pony"
		}]
	};
	const resourceCollections = {
		workspace: "myWorkspace",
		dependencies: "myDependencies"
	};
	const getInterfaceStub = sinon.stub().returns(undefined);
	const taskUtil = {
		getInterface: getInterfaceStub
	};
	const customBuilder = new CustomBuilder({project, resourceCollections, taskUtil});
	customBuilder.tasks["myTask"]();

	t.is(getInterfaceStub.callCount, 1, "taskUtil.getInterface got called once");
	t.deepEqual(getInterfaceStub.getCall(0).args[0], "2.0", "taskUtil.getInterface got called with correct argument");

	t.is(customTaskStub.callCount, 1, "Custom task got called once");
	t.deepEqual(customTaskStub.getCall(0).args[0], {
		options: {
			projectName: "application.b",
			projectNamespace: "application/b",
			configuration: "pony"
		},
		workspace: "myWorkspace",
		dependencies: "myDependencies"
	}, "Custom task got called with expected arguments");
});

test.serial("Instantiation with custom task specVersion 2.2: Custom task called correctly", (t) => {
	const customTaskStub = sinon.stub();
	sinon.stub(taskRepository, "getTask").returns({
		task: customTaskStub,
		specVersion: "2.2"
	});

	const project = clone(applicationBTree);
	project.builder = {
		customTasks: [{
			name: "myTask",
			beforeTask: "replaceVersion",
			configuration: "pony"
		}]
	};
	const resourceCollections = {
		workspace: "myWorkspace",
		dependencies: "myDependencies"
	};
	const getInterfaceStub = sinon.stub().returns("myTaskUtilInterface");
	const taskUtil = {
		getInterface: getInterfaceStub
	};
	const customBuilder = new CustomBuilder({project, resourceCollections, taskUtil});
	customBuilder.tasks["myTask"]();

	t.is(getInterfaceStub.callCount, 1, "taskUtil.getInterface got called once");
	t.deepEqual(getInterfaceStub.getCall(0).args[0], "2.2", "taskUtil.getInterface got called with correct argument");

	t.is(customTaskStub.callCount, 1, "Custom task got called once");
	t.deepEqual(customTaskStub.getCall(0).args[0], {
		options: {
			projectName: "application.b",
			projectNamespace: "application/b",
			configuration: "pony"
		},
		workspace: "myWorkspace",
		dependencies: "myDependencies",
		taskUtil: "myTaskUtilInterface"
	}, "Custom task got called with expected arguments");
});

test.serial("Instantiation with custom task: Two custom tasks called correctly", (t) => {
	const customTaskStub1 = sinon.stub();
	const customTaskStub2 = sinon.stub();
	const stubGetTask = sinon.stub(taskRepository, "getTask");
	stubGetTask.onCall(0).returns({
		task: customTaskStub1,
		specVersion: "2.0"
	});
	stubGetTask.onCall(1).returns({
		task: customTaskStub2,
		specVersion: "2.0"
	});

	const project = clone(applicationBTree);
	project.builder = {
		customTasks: [{
			name: "myTask",
			beforeTask: "replaceVersion",
			configuration: "pony"
		}, {
			name: "myTask",
			beforeTask: "myStandardTask",
			configuration: "donkey"
		}]
	};
	const resourceCollections = {
		workspace: "myWorkspace",
		dependencies: "myDependencies"
	};
	const getInterfaceStub = sinon.stub().returns(undefined);
	const taskUtil = {
		getInterface: getInterfaceStub
	};
	const customBuilder = new CustomBuilder({project, resourceCollections, taskUtil});
	customBuilder.tasks["myTask"]();
	customBuilder.tasks["myTask--1"]();

	t.is(getInterfaceStub.callCount, 2, "taskUtil.getInterface got called once");
	t.deepEqual(getInterfaceStub.getCall(0).args[0], "2.0", "taskUtil.getInterface got called with correct argument");
	t.deepEqual(getInterfaceStub.getCall(1).args[0], "2.0", "taskUtil.getInterface got called with correct argument");

	t.is(customTaskStub1.callCount, 1, "Custom task got called once");
	t.deepEqual(customTaskStub1.getCall(0).args[0], {
		options: {
			projectName: "application.b",
			projectNamespace: "application/b",
			configuration: "pony"
		},
		workspace: "myWorkspace",
		dependencies: "myDependencies"
	}, "Custom task got called with expected arguments");

	t.is(customTaskStub2.callCount, 1, "Custom task got called once");
	t.deepEqual(customTaskStub2.getCall(0).args[0], {
		options: {
			projectName: "application.b",
			projectNamespace: "application/b",
			configuration: "donkey"
		},
		workspace: "myWorkspace",
		dependencies: "myDependencies"
	}, "Custom task got called with expected arguments");
});

test("addTask: Add task", (t) => {
	const project = clone(applicationBTree);
	const customBuilder = new CustomBuilder({project});
	const myFunction = function() {};
	customBuilder.addTask("myTask", myFunction);
	t.is(customBuilder.tasks["myTask"], myFunction, "Task has been added to task array");
	t.true(customBuilder.taskExecutions.myTask.includes("myTask"), "Task executions contains task");
	t.deepEqual(customBuilder.taskExecutionOrder[customBuilder.taskExecutionOrder.length - 1], "myTask",
		"Task has been added to end of execution order array");
});

test("addTask: Add duplicate task", (t) => {
	const project = clone(applicationBTree);
	const customBuilder = new CustomBuilder({project});
	const myFunction = function() {};
	customBuilder.addTask("myTask", myFunction);
	const error = t.throws(() => {
		customBuilder.addTask("myTask", myFunction);
	});
	t.deepEqual(error.message, "Failed to add duplicate task myTask for project application.b",
		"Correct exception thrown");
});

test("addTask: Add task with identifier", (t) => {
	const project = clone(applicationBTree);
	const customBuilder = new CustomBuilder({project});
	const myFunction = function() {};
	customBuilder.addTask("myTaskA", "myTask", myFunction);
	customBuilder.addTask("myTaskB", "myTask", myFunction);
	t.is(customBuilder.tasks["myTaskA"], myFunction, "Task A has been added to task array");
	t.is(customBuilder.tasks["myTaskB"], myFunction, "Task B has been added to task array");
	t.true(customBuilder.taskExecutions.myTask.includes("myTaskA"), "Task executions contains task A");
	t.true(customBuilder.taskExecutions.myTask.includes("myTaskB"), "Task executions contains task B");
	t.deepEqual(customBuilder.taskExecutionOrder[customBuilder.taskExecutionOrder.length - 2], "myTaskA",
		"Task A has been added to end of execution order array");
	t.deepEqual(customBuilder.taskExecutionOrder[customBuilder.taskExecutionOrder.length - 1], "myTaskB",
		"Task B has been added to end of execution order array");
});

test("addTask: Add task already added to execution order", (t) => {
	const project = clone(applicationBTree);
	const customBuilder = new CustomBuilder({project});
	const myFunction = function() {};
	customBuilder.taskExecutionOrder.push("myTask");
	const error = t.throws(() => {
		customBuilder.addTask("myTask", myFunction);
	});
	t.deepEqual(error.message, "Builder: Failed to add task myTask for project application.b. " +
		"It has already been scheduled for execution.", "Correct exception thrown");
});
