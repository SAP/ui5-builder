import test from "ava";
import sinonGlobal from "sinon";
import minify from "../../../lib/tasks/minify.js";
import * as resourceFactory from "@ui5/fs/resourceFactory";
import DuplexCollection from "@ui5/fs/DuplexCollection";

// Node.js itself tries to parse sourceMappingURLs in all JavaScript files. This is unwanted and might even lead to
// obscure errors when dynamically generating Data-URI soruceMappingURL values.
// Therefore use this constant to never write the actual string.
const SOURCE_MAPPING_URL = "//" + "# sourceMappingURL";

function createWorkspace() {
	const reader = resourceFactory.createAdapter({
		virBasePath: "/",
	});
	const writer = resourceFactory.createAdapter({
		virBasePath: "/",
	});
	const workspace = new DuplexCollection({reader: reader, writer: writer});
	return {reader, writer, workspace};
}

test.beforeEach((t) => {
	t.context.sinon = sinonGlobal.createSandbox();
});

test.afterEach.always((t) => {
	t.context.sinon.restore();
});

test.serial("integration: minify omitSourceMapResources=true", async (t) => {
	const taskUtil = {
		setTag: t.context.sinon.stub(),
		STANDARD_TAGS: {
			HasDebugVariant: "1️⃣",
			IsDebugVariant: "2️⃣",
			OmitFromBuildResult: "3️⃣",
		},
		registerCleanupTask: t.context.sinon.stub(),
	};
	const {reader, writer, workspace} = createWorkspace();
	const content = `
function test(paramA) {
	var variableA = paramA;
	console.log(variableA);
}
test();`;
	const testResource = resourceFactory.createResource({
		path: "/test.js",
		string: content,
	});
	await reader.write(testResource);

	await minify({
		workspace,
		taskUtil,
		options: {
			pattern: "/test.js",
			omitSourceMapResources: true,
		},
	});

	const expected = `function test(t){var o=t;console.log(o)}test();`;
	const res = await writer.byPath("/test.js");
	if (!res) {
		t.fail("Could not find /test.js in target locator");
	}
	t.deepEqual(await res.getString(), expected, "Correct file content");

	const resDbg = await writer.byPath("/test-dbg.js");
	if (!resDbg) {
		t.fail("Could not find /test-dbg.js in target locator");
	}
	t.deepEqual(await resDbg.getString(), content, "Correct debug-file content");

	const expectedSourceMap =
		`{"version":3,"file":"test.js",` +
		`"names":["test","paramA","variableA","console","log"],"sources":["test-dbg.js"],` +
		`"mappings":"AACA,SAASA,KAAKC,GACb,IAAIC,EAAYD,EAChBE,QAAQC,IAAIF,EACb,CACAF","ignoreList":[]}`;

	const resSourceMap = await writer.byPath("/test.js.map");
	if (!resSourceMap) {
		t.fail("Could not find /test-dbg.js.map in target locator");
	}
	t.deepEqual(await resSourceMap.getString(), expectedSourceMap, "Correct source map content");

	t.is(taskUtil.setTag.callCount, 4, "taskUtil.setTag was called 4 times");
	t.is(taskUtil.setTag.getCall(0).args[0].getPath(), res.getPath(),
		"First taskUtil.setTag call with expected first argument");
	t.is(taskUtil.setTag.getCall(0).args[1], "1️⃣", "First taskUtil.setTag call with expected second argument");
	t.is(taskUtil.setTag.getCall(1).args[0].getPath(), resDbg.getPath(),
		"Second taskUtil.setTag call with expected first arguments");
	t.is(taskUtil.setTag.getCall(1).args[1], "2️⃣",
		"Second taskUtil.setTag call with expected second arguments");
	t.is(taskUtil.setTag.getCall(2).args[0].getPath(), resSourceMap.getPath(),
		"Third taskUtil.setTag call with expected first arguments");
	t.is(taskUtil.setTag.getCall(2).args[1], "1️⃣",
		"Third taskUtil.setTag call with expected second arguments");
	t.is(taskUtil.setTag.getCall(3).args[0].getPath(), resSourceMap.getPath(),
		"Fourth taskUtil.setTag call with expected first arguments");
	t.is(taskUtil.setTag.getCall(3).args[1], "3️⃣",
		"Fourth taskUtil.setTag call with expected second arguments");

	// Ensure to call cleanup task so that workerpool is terminated - otherwise the test will time out!
	const cleanupTask = taskUtil.registerCleanupTask.getCall(0).args[0];
	await cleanupTask();
});

test.serial("integration: minify omitSourceMapResources=false", async (t) => {
	const taskUtil = {
		setTag: t.context.sinon.stub(),
		STANDARD_TAGS: {
			HasDebugVariant: "1️⃣",
			IsDebugVariant: "2️⃣",
			OmitFromBuildResult: "3️⃣",
		},
		registerCleanupTask: t.context.sinon.stub(),
	};
	const {reader, writer, workspace} = createWorkspace();
	const content = `
function test(paramA) {
	var variableA = paramA;
	console.log(variableA);
}
test();`;
	const testResource = resourceFactory.createResource({
		path: "/test.js",
		string: content,
	});
	await reader.write(testResource);

	await minify({
		workspace,
		taskUtil,
		options: {
			pattern: "/test.js",
		},
	});

	const expected = `function test(t){var o=t;console.log(o)}test();
${SOURCE_MAPPING_URL}=test.js.map`;
	const res = await writer.byPath("/test.js");
	if (!res) {
		t.fail("Could not find /test.js in target locator");
	}
	t.deepEqual(await res.getString(), expected, "Correct file content");

	const resDbg = await writer.byPath("/test-dbg.js");
	if (!resDbg) {
		t.fail("Could not find /test-dbg.js in target locator");
	}
	t.deepEqual(await resDbg.getString(), content, "Correct debug-file content");

	const expectedSourceMap =
		`{"version":3,"file":"test.js",` +
		`"names":["test","paramA","variableA","console","log"],"sources":["test-dbg.js"],` +
		`"mappings":"AACA,SAASA,KAAKC,GACb,IAAIC,EAAYD,EAChBE,QAAQC,IAAIF,EACb,CACAF","ignoreList":[]}`;

	const resSourceMap = await writer.byPath("/test.js.map");
	if (!resSourceMap) {
		t.fail("Could not find /test-dbg.js.map in target locator");
	}
	t.deepEqual(await resSourceMap.getString(), expectedSourceMap, "Correct source map content");

	t.is(taskUtil.setTag.callCount, 3, "taskUtil.setTag was called 3 times");
	t.is(taskUtil.setTag.getCall(0).args[0].getPath(), res.getPath(),
		"First taskUtil.setTag call with expected first argument");
	t.is(taskUtil.setTag.getCall(0).args[1], "1️⃣", "First taskUtil.setTag call with expected second argument");
	t.is(taskUtil.setTag.getCall(1).args[0].getPath(), resDbg.getPath(),
		"Second taskUtil.setTag call with expected first arguments");
	t.is(taskUtil.setTag.getCall(1).args[1], "2️⃣",
		"Second taskUtil.setTag call with expected second arguments");
	t.is(taskUtil.setTag.getCall(2).args[0].getPath(), resSourceMap.getPath(),
		"Third taskUtil.setTag call with expected first arguments");
	t.is(taskUtil.setTag.getCall(2).args[1], "1️⃣",
		"Third taskUtil.setTag call with expected second arguments");

	// Ensure to call cleanup task so that workerpool is terminated - otherwise the test will time out!
	const cleanupTask = taskUtil.registerCleanupTask.getCall(0).args[0];
	await cleanupTask();
});

test("integration: minify omitSourceMapResources=true (without taskUtil)", async (t) => {
	const {reader, writer, workspace} = createWorkspace();
	const content = `
function test(paramA) {
	var variableA = paramA;
	console.log(variableA);
}
test();`;
	const testResource = resourceFactory.createResource({
		path: "/test.js",
		string: content,
	});
	await reader.write(testResource);

	await minify({
		workspace,
		options: {
			pattern: "/test.js",
			omitSourceMapResources: true,
		},
	});

	const expected = `function test(t){var o=t;console.log(o)}test();`;
	const res = await writer.byPath("/test.js");
	if (!res) {
		t.fail("Could not find /test.js in target locator");
	}
	t.deepEqual(await res.getString(), expected, "Correct file content");

	const resDbg = await writer.byPath("/test-dbg.js");
	if (!resDbg) {
		t.fail("Could not find /test-dbg.js in target locator");
	}
	t.deepEqual(await resDbg.getString(), content, "Correct debug-file content");

	const expectedSourceMap =
		`{"version":3,"file":"test.js",` +
		`"names":["test","paramA","variableA","console","log"],"sources":["test-dbg.js"],` +
		`"mappings":"AACA,SAASA,KAAKC,GACb,IAAIC,EAAYD,EAChBE,QAAQC,IAAIF,EACb,CACAF","ignoreList":[]}`;

	const resSourceMap = await writer.byPath("/test.js.map");
	if (!resSourceMap) {
		t.fail("Could not find /test-dbg.js.map in target locator");
	}
	t.deepEqual(await resSourceMap.getString(), expectedSourceMap, "Correct source map content");
});

test("integration: minify omitSourceMapResources=false (without taskUtil)", async (t) => {
	const {reader, writer, workspace} = createWorkspace();
	const content = `
function test(paramA) {
	var variableA = paramA;
	console.log(variableA);
}
test();`;
	const testResource = resourceFactory.createResource({
		path: "/test.js",
		string: content,
	});
	await reader.write(testResource);

	await minify({
		workspace,
		options: {
			pattern: "/test.js",
			omitSourceMapResources: false,
		},
	});

	const expected = `function test(t){var o=t;console.log(o)}test();
${SOURCE_MAPPING_URL}=test.js.map`;
	const res = await writer.byPath("/test.js");
	if (!res) {
		t.fail("Could not find /test.js in target locator");
	}
	t.deepEqual(await res.getString(), expected, "Correct file content");

	const resDbg = await writer.byPath("/test-dbg.js");
	if (!resDbg) {
		t.fail("Could not find /test-dbg.js in target locator");
	}
	t.deepEqual(await resDbg.getString(), content, "Correct debug-file content");

	const expectedSourceMap =
		`{"version":3,"file":"test.js",` +
		`"names":["test","paramA","variableA","console","log"],"sources":["test-dbg.js"],` +
		`"mappings":"AACA,SAASA,KAAKC,GACb,IAAIC,EAAYD,EAChBE,QAAQC,IAAIF,EACb,CACAF","ignoreList":[]}`;

	const resSourceMap = await writer.byPath("/test.js.map");
	if (!resSourceMap) {
		t.fail("Could not find /test-dbg.js.map in target locator");
	}
	t.deepEqual(await resSourceMap.getString(), expectedSourceMap, "Correct source map content");
});
