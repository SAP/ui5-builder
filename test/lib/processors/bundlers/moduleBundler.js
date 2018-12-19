const {test} = require("ava");

const moduleBundler = require("../../../../lib/processors/bundlers/moduleBundler");

test("moduleBundler empty resources", async (t) => {
	const resources = [];
	const options = {bundleDefinition: {name: "mybundle", sections: []}};
	const aResult = await moduleBundler({resources, options});
	t.deepEqual(aResult[0].getPath(), "/resources/mybundle");
});
