const test = require("ava");

const ResourceCollector = require("../../../../lib/lbt/resources/ResourceCollector");

test("add: empty constructor dummy params", (t) => {
	const resourceCollector = new ResourceCollector({}, {});
	t.is(resourceCollector.resources.size, 0, "empty");
});

test("add: empty constructor", (t) => {
	const resourceCollector = new ResourceCollector();
	t.is(resourceCollector.resources.size, 0, "empty");
});

test("setExternalResources: empty filters", (t) => {
	const resourceCollector = new ResourceCollector();
	resourceCollector.setExternalResources({
		"testcomp": []
	});
	const orphanFilters = resourceCollector.createOrphanFilters();
	t.is(orphanFilters.size, 1, "1 filter");
});

test("createOrphanFilters: filters", (t) => {
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
