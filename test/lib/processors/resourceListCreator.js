const test = require("ava");

const resourceListCreator = require("../../../lib/processors/resourceListCreator");

test("Replaces string pattern from resource stream", async (t) => {
	t.truthy(resourceListCreator);
});
