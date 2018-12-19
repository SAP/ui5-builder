const {test} = require("ava");

const taskRepository = require("../../../lib/tasks/taskRepository");

test("task retrieval", (t) => {
	const myTask = {};
	taskRepository.addTask("myTaskR", myTask);
	const task = taskRepository.getTask("myTaskR");
	t.is(task, myTask);
});

test("Unknown task retrieval", (t) => {
	const error = t.throws(() => {
		taskRepository.getTask("not-existing");
	}, Error);
	t.is(error.message, "taskRepository: Unknown Task not-existing");
});

test("Duplicate task", (t) => {
	const myTask = {};
	taskRepository.addTask("myTask", myTask);
	const error = t.throws(() => {
		taskRepository.addTask("myTask", myTask);
	}, Error);
	t.is(error.message, "taskRepository: Task myTask already registered");
});
