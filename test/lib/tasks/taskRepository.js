const path = require("path");
const test = require("ava");

const taskRepository = require("../../../lib/tasks/taskRepository");

test("task retrieval", (t) => {
	const taskPath = path.join(__dirname, "..", "..", "..", "lib", "tasks", "escapeNonAsciiCharacters");
	taskRepository.addTask({
		name: "myTask",
		specVersion: "2.0",
		taskPath: taskPath
	});
	const taskInfo = taskRepository.getTask("myTask");
	t.deepEqual(taskInfo, {
		task: require(taskPath),
		specVersion: "2.0"
	});
});

test("Unknown task retrieval", (t) => {
	const error = t.throws(() => {
		taskRepository.getTask("not-existing");
	});
	t.deepEqual(error.message, "taskRepository: Unknown Task not-existing", "Correct exception");
});

test("Removed task retrieval", (t) => {
	const error = t.throws(() => {
		taskRepository.getTask("createDebugFiles");
	});
	t.deepEqual(error.message,
		`Standard task createDebugFiles has been removed in UI5 Tooling 3.0. ` +
		`Please see the migration guide at https://sap.github.io/ui5-tooling/updates/migrate-v3/`,
		"Correct exception");

	const error2 = t.throws(() => {
		taskRepository.getTask("uglify");
	});
	t.deepEqual(error2.message,
		`Standard task uglify has been removed in UI5 Tooling 3.0. ` +
		`Please see the migration guide at https://sap.github.io/ui5-tooling/updates/migrate-v3/`,
		"Correct exception");
});

test("Duplicate task", (t) => {
	const myTask = {};
	taskRepository.addTask("myOtherTask", myTask);
	const error = t.throws(() => {
		taskRepository.addTask("myOtherTask", myTask);
	});
	t.deepEqual(error.message, "taskRepository: A task with the name undefined has already been registered",
		"Correct exception");
});

test("Task with invalid path", (t) => {
	taskRepository.addTask({
		name: "myTaskWithInvalidPath",
		specVersion: "2.0",
		taskPath: "/path/does/not/exist"
	});
	const error = t.throws(() => {
		taskRepository.getTask("myTaskWithInvalidPath");
	});
	t.regex(error.message,
		new RegExp("^taskRepository: Failed to require task module for myTaskWithInvalidPath: " +
			"Cannot find module '/path/does/not/exist'"),
		"Error message starts with expected text");
});
