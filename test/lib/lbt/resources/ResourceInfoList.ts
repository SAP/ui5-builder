import test from "ava";
import ResourceInfoList from "../../../../lib/lbt/resources/ResourceInfoList.js";

test("add: add new resources", (t) => {
	const resourceInfoList = new ResourceInfoList("prefix");

	const myInfo = {name: "myfile.js", size: 13};
	t.deepEqual(resourceInfoList.resources, [], "empty list");

	resourceInfoList.add(myInfo);

	t.is(resourceInfoList.resources.length, 1, "one entry");

	const result = resourceInfoList.resources[0];
	t.falsy(result.module, "module is not set");
});

test("add: add non-debug resource", (t) => {
	const resourceInfoList = new ResourceInfoList("prefix");

	resourceInfoList.add({name: "myfile.js", module: "myfile.js", size: 13, required: new Set(["some-dep.js"])});

	t.is(resourceInfoList.resources.length, 1, "one resource added");

	const result = resourceInfoList.resourcesByName.get("../myfile.js");
	t.is(result.module, "myfile.js", "module is set");
	t.deepEqual(result.required, new Set(["some-dep.js"]), "module is set");
});

test("add: add debug resources", (t) => {
	const resourceInfoList = new ResourceInfoList("prefix");

	resourceInfoList.add({name: "myfile-dbg.js", size: 13, required: new Set(["some-dep.js"])});

	t.is(resourceInfoList.resources.length, 1, "one resource added");

	const resultDbg = resourceInfoList.resourcesByName.get("../myfile-dbg.js");
	// Note: "module" will be set properly for debug resources within ResourceCollector#determineResourceDetails
	t.is(resultDbg.module, undefined, "module is not set");
	t.deepEqual(resultDbg.required, new Set(["some-dep.js"]), "module is set");
});

test("add: add i18n resource", (t) => {
	const resourceInfoList = new ResourceInfoList("prefix");

	resourceInfoList.add({name: "i18n_en.properties", i18nName: "i18n.properties", size: 13});

	t.is(resourceInfoList.resources.length, 1, "one entry");

	const result = resourceInfoList.resourcesByName.get("../i18n_en.properties");
	t.is(result.i18nName, "../i18n.properties", "i18n name is set relative");
});

test("add: resource with the same name", (t) => {
	const resourceInfoList = new ResourceInfoList("prefix");

	resourceInfoList.add({name: "myfile.js", size: 13});
	resourceInfoList.add({name: "myfile.js", size: 13});

	t.is(resourceInfoList.resources.length, 1, "one entry");

	const result = resourceInfoList.resourcesByName.get("../myfile.js");
	t.is(result.name, "../myfile.js", "name is set relative");
});

test("toJSON: resource with the same name", (t) => {
	const resourceInfoList = new ResourceInfoList("prefix");

	resourceInfoList.resources.push({name: "myfile.js", size: 13});
	resourceInfoList.resources.push({name: "myfile.js", size: 13});

	t.deepEqual(resourceInfoList.toJSON(), {
		_version: "1.1.0",
		resources: [
			{
				name: "myfile.js",
				size: 13,
			},
			{
				name: "myfile.js",
				size: 13,
			},
		],
	}, "one entry");
});

test("makePathRelativeTo: same prefix", (t) => {
	const relativePath = ResourceInfoList.makePathRelativeTo("am/bn/cf", "args/myfile.js");

	t.is(relativePath, "../../../args/myfile.js", "relative path");
});
