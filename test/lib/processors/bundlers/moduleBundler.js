const {test} = require("ava");

const moduleBundler = require("../../../../lib/processors/bundlers/moduleBundler");

test("moduleBundler with empty resources", async (t) => {
	const resources = [];
	const options = {bundleDefinition: {name: "mybundle", sections: []}};
	const aResult = await moduleBundler({resources, options});

	t.is(aResult.length, 1, "There should be only one element");
	const oResult = aResult[0];

	// check path created from options
	t.deepEqual(oResult.getPath(), "/resources/mybundle", "path must be created from options");

	// check content must throw an error
	const error = t.throws(oResult.getString);
	t.deepEqual(error.message, "Cannot read property 'getBuffer' of undefined", "Result must contain the content");
});
