const test = require("ava");
const sinon = require("sinon");

const mock = require("mock-require");
const logger = require("@ui5/logger");

let versionInfoGenerator = require("../../../lib/processors/versionInfoGenerator");


test("versionInfoGenerator missing parameters", async (t) => {
	const error = await t.throwsAsync(versionInfoGenerator({options: {}}));
	t.deepEqual(error.message, "[versionInfoGenerator]: Missing options parameters");
});

test.beforeEach((t) => {
	t.context.clock = sinon.useFakeTimers(1610642400000);
	t.context.warnLogStub = sinon.stub();
	sinon.stub(logger, "getLogger").returns({
		warn: t.context.warnLogStub,
		isLevelEnabled: () => true
	});
	versionInfoGenerator = mock.reRequire("../../../lib/processors/versionInfoGenerator");
});

test.afterEach.always((t) => {
	t.context.clock.restore();
	mock.stopAll();
	sinon.restore();
});

test.serial("versionInfoGenerator empty libraryInfos parameter", async (t) => {
	const versionInfos = await versionInfoGenerator({options: {
		rootProjectName: "myname", rootProjectVersion: "1.33.7", libraryInfos: []}});

	const resource = versionInfos[0];
	const result = await resource.getString();

	const expected = `{
	"name": "myname",
	"version": "1.33.7",
	"buildTimestamp": "202101141740",
	"scmRevision": "",
	"libraries": []
}`;
	t.is(result, expected);
});


test.serial("versionInfoGenerator simple library infos", async (t) => {
	const options = {
		rootProjectName: "myname", rootProjectVersion: "1.33.7", libraryInfos: [
			{name: "my.lib", version: "1.2.3"}
		]};
	const versionInfos = await versionInfoGenerator({options});

	const resource = versionInfos[0];
	const result = await resource.getString();

	const expected = `{
	"name": "myname",
	"version": "1.33.7",
	"buildTimestamp": "202101141740",
	"scmRevision": "",
	"libraries": [
		{
			"name": "my.lib",
			"version": "1.2.3",
			"buildTimestamp": "202101141740",
			"scmRevision": ""
		}
	]
}`;
	t.is(result, expected);
	t.is(t.context.warnLogStub.callCount, 1);
	t.is(t.context.warnLogStub.getCall(0).args[0],
		"Cannot add meta information for library 'my.lib'. The manifest.json file cannot be found");
});
