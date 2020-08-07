const test = require("ava");

const ResourcesList = require("../../../../lib/lbt/resources/ResourcesList");

test("add: add new resources", (t) => {
	const resourcesList = new ResourcesList("prefix");

	const myInfo = {name: "myfile.js", size: 13};
	t.deepEqual(resourcesList.resources, [], "empty list");

	resourcesList.add(myInfo);

	t.is(resourcesList.resources.length, 1, "one entry");

	const result = resourcesList.resources[0];
	t.falsy(result.module, "module is not set");
});

test("add: add source then debug resources", (t) => {
	const resourcesList = new ResourcesList("prefix");

	resourcesList.add({name: "myfile.js", module: "myfile.js", size: 13});

	const myInfo = {name: "myfile-dbg.js", size: 13};
	resourcesList.add(myInfo);

	t.is(resourcesList.resources.length, 2, "two entries");

	const result = resourcesList.resourcesByName.get("../myfile.js");
	t.is(result.module, "myfile.js", "module is set");

	const resultDbg = resourcesList.resourcesByName.get("../myfile-dbg.js");
	t.is(resultDbg.module, "myfile.js", "module is set");
});

test("add: add debug then source resources", (t) => {
	const resourcesList = new ResourcesList("prefix");

	resourcesList.add({name: "myfile-dbg.js", size: 13});

	const myInfo = {name: "myfile.js", module: "myfile.js", size: 13};
	resourcesList.add(myInfo);

	t.is(resourcesList.resources.length, 2, "two entries");

	const result = resourcesList.resourcesByName.get("../myfile.js");
	t.is(result.module, "myfile.js", "module is set");

	const resultDbg = resourcesList.resourcesByName.get("../myfile-dbg.js");
	t.is(resultDbg.module, "myfile.js", "module is set");
});

test("add: add i18n resource", (t) => {
	const resourcesList = new ResourcesList("prefix");

	resourcesList.add({name: "i18n_en.properties", i18nName: "i18n.properties", size: 13});

	t.is(resourcesList.resources.length, 1, "one entry");

	const result = resourcesList.resourcesByName.get("../i18n_en.properties");
	t.is(result.i18nName, "../i18n.properties", "i18n name is set relative");
});
