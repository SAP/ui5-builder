const test = require("ava");
const sinon = require("sinon");
const mock = require("mock-require");

test.afterEach.always((t) => {
	sinon.restore();
	mock.stopAll();
});

const BuildContext = require("../../../lib/builder/BuildContext");

test("Missing parameters", (t) => {
	const error = t.throws(() => {
		new BuildContext({});
	});

	t.is(error.message, `Missing parameter 'rootProject'`, "Threw with expected error message");
});

test("getRootProject", (t) => {
	const buildContext = new BuildContext({
		rootProject: "pony"
	});

	t.is(buildContext.getRootProject(), "pony", "Returned correct value");
});

test("getBuildOption", (t) => {
	const buildContext = new BuildContext({
		rootProject: "root_project",
		options: {
			a: true,
			b: "Pony",
			c: 235,
			d: {
				d1: "Bee"
			}
		}
	});

	t.is(buildContext.getOption("a"), true, "Returned 'boolean' value is correct");
	t.is(buildContext.getOption("b"), "Pony", "Returned 'String' value is correct");
	t.is(buildContext.getOption("c"), 235, "Returned 'Number' value is correct");
	t.deepEqual(buildContext.getOption("d"), {d1: "Bee"}, "Returned 'object' value is correct");
});

test.serial("createProjectContext", (t) => {
	class DummyProjectContext {
		constructor({buildContext, project, resources}) {
			t.is(buildContext, testBuildContext, "Correct buildContext parameter");
			t.is(project, "project", "Correct project parameter");
			t.is(resources, "resources", "Correct resources parameter");
		}
	}
	mock("../../../lib/builder/ProjectBuildContext", DummyProjectContext);

	const BuildContext = mock.reRequire("../../../lib/builder/BuildContext");
	const testBuildContext = new BuildContext({
		rootProject: "pony"
	});

	const projectContext = testBuildContext.createProjectContext({
		project: "project",
		resources: "resources"
	});

	t.true(projectContext instanceof DummyProjectContext,
		"Project context is an instance of DummyProjectContext");
	t.is(testBuildContext.projectBuildContexts[0], projectContext,
		"BuildContext stored correct ProjectBuildContext");
});

test("executeCleanupTasks", async (t) => {
	const buildContext = new BuildContext({
		rootProject: "pony"
	});

	const executeCleanupTasks = sinon.stub().resolves();

	buildContext.projectBuildContexts.push({
		executeCleanupTasks
	});
	buildContext.projectBuildContexts.push({
		executeCleanupTasks
	});

	await buildContext.executeCleanupTasks();

	t.is(executeCleanupTasks.callCount, 2,
		"Project context executeCleanupTasks got called twice");
});
