const test = require("ava");
const sinon = require("sinon");
const mock = require("mock-require");

let ResourceCollector = require("../../../../lib/lbt/resources/ResourceCollector");

test.beforeEach((t) => {
	// Spying logger of processors/bootstrapHtmlTransformer
	const log = require("@ui5/logger");
	const loggerInstance = log.getLogger("lbt:resources:ResourceCollector");
	mock("@ui5/logger", {
		getLogger: () => loggerInstance
	});
	mock.reRequire("@ui5/logger");
	t.context.logWarnSpy = sinon.spy(loggerInstance, "warn");

	// Re-require tested module
	ResourceCollector = mock.reRequire("../../../../lib/lbt/resources/ResourceCollector");
});

test.afterEach.always((t) => {
	mock.stop("@ui5/logger");
	t.context.logWarnSpy.restore();
});


test.serial("add: empty constructor dummy params", (t) => {
	const resourceCollector = new ResourceCollector({}, {});
	t.is(resourceCollector.resources.size, 0, "empty");
});

test.serial("add: empty constructor", (t) => {
	const resourceCollector = new ResourceCollector();
	t.is(resourceCollector.resources.size, 0, "empty");
});

test.serial("setExternalResources: empty filters", (t) => {
	const resourceCollector = new ResourceCollector();
	resourceCollector.setExternalResources({
		"testcomp": []
	});
	const orphanFilters = resourceCollector.createOrphanFilters();
	t.is(orphanFilters.size, 1, "1 filter");
});

test.serial("createOrphanFilters: filters", (t) => {
	const resourceCollector = new ResourceCollector();
	resourceCollector.setExternalResources({
		"testcomp": ["test"],
		"/": ["test"],
		"": ["test"],
		"a/": ["test"],
		"b": ["test"],
	});
	const orphanFilters = resourceCollector.createOrphanFilters();
	t.is(orphanFilters.size, 4, "4 filters");
});

test.serial("visitResource: path", (t) => {
	const resourceCollector = new ResourceCollector();
	resourceCollector.visitResource("mypath", 13);
	t.is(t.context.logWarnSpy.callCount, 1);
	t.is(t.context.logWarnSpy.getCall(0).args[0], "non-runtime resource mypath ignored");
});

test.serial("groupResourcesByComponents: debugBundles", (t) => {
	const resourceCollector = new ResourceCollector();
	resourceCollector.setExternalResources({
		"testcomp": ["my/file.js"]
	});
	resourceCollector.visitResource("/resources/testcomp/Component.js", 13);
	resourceCollector.visitResource("/resources/my/file.js", 13);
	resourceCollector.groupResourcesByComponents({debugBundles: ".*-dbg.js"});
	t.is(resourceCollector.resources.size, 0, "all resources were deleted");
});
