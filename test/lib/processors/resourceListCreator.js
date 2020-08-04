const test = require("ava");
const sinon = require("sinon");
const mock = require("mock-require");

let resourceListCreator = require("../../../lib/processors/resourceListCreator");
const resourceFactory = require("@ui5/fs").resourceFactory;

test.beforeEach((t) => {
	// Spying logger of processors/bootstrapHtmlTransformer
	const log = require("@ui5/logger");
	const loggerInstance = log.getLogger("builder:processors:resourceListCreator");
	mock("@ui5/logger", {
		getLogger: () => loggerInstance
	});
	mock.reRequire("@ui5/logger");
	t.context.logErrorSpy = sinon.spy(loggerInstance, "error");

	// Re-require tested module
	resourceListCreator = mock.reRequire("../../../lib/processors/resourceListCreator");
});

test.afterEach.always((t) => {
	mock.stop("@ui5/logger");
	t.context.logErrorSpy.restore();
});

test.serial("Empty resources", async (t) => {
	const result = await resourceListCreator({
		resources: []
	});
	t.deepEqual(result, []);
});

test.serial("Orphaned resources", async (t) => {
	const resource = resourceFactory.createResource({
		path: "/resources/nomodule.foo",
		string: "bar content"
	});
	const errorObject = await t.throwsAsync(() => {
		return resourceListCreator({
			resources: [resource]
		});
	});
	t.is(errorObject.message, "resources.json generation failed with error: There are 1 resources which could not be assigned to components.");
	t.is(t.context.logErrorSpy.callCount, 1);
	t.is(t.context.logErrorSpy.getCall(0).args[0], "resources.json generation failed because of unassigned resources: nomodule.foo");
});
