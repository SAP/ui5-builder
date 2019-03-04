const {test} = require("ava");
const sinon = require("sinon");
const tmp = require("tmp");

const mock = require("mock-require");

const generateJsdoc = require("../../../lib/tasks/generateJsdoc");

test.beforeEach((t) => {
	t.context.tmpStub = sinon.stub(tmp, "dir");
});

test.afterEach.always((t) => {
	t.context.tmpStub.restore();
});

test.serial("createTmpDir successful", async (t) => {
	t.context.tmpStub.callsArgWithAsync(1, undefined, "some/path");

	const res = await generateJsdoc._createTmpDir("some.namespace");

	t.deepEqual(t.context.tmpStub.callCount, 1, "Tmp dir is called once");
	t.deepEqual(t.context.tmpStub.getCall(0).args[0].prefix, "ui5-tooling-tmp-jsdoc-some.namespace-");
	t.deepEqual(res, {path: "some/path"}, "Correct path returned");
});

test.serial("createTmpDir error", async (t) => {
	t.context.tmpStub.callsArgWithAsync(1, {message: "Dir creation failed"}, "some/path");

	const res = await t.throws(generateJsdoc._createTmpDir("some.namespace"));

	t.deepEqual(t.context.tmpStub.callCount, 1, "Tmp dir is called once");
	t.deepEqual(t.context.tmpStub.getCall(0).args[0].prefix, "ui5-tooling-tmp-jsdoc-some.namespace-");
	t.deepEqual(res, {message: "Dir creation failed"}, "Dir creation failed");
});

test.serial("createTempDirs", async (t) => {
	mock("make-dir", function() {
		return Promise.resolve();
	});
	mock.reRequire("make-dir");

	t.context.tmpStub.callsArgWithAsync(1, undefined, "some/path");

	const res = await generateJsdoc._createTmpDirs("some.namespace");

	t.deepEqual(res, {sourcePath: "some/path/src", targetPath: "some/path/target", tmpPath: "some/path/tmp"},
		"Correct temporary directories returned");

	mock.stop("make-dir");
});

test.serial("writeResourcesToDir", async (t) => {
	const writeStub = sinon.stub().resolves("some resource");
	const createAdapterStub = sinon.stub(require("@ui5/fs").resourceFactory, "createAdapter").returns({
		write: writeStub
	});

	generateJsdoc._writeResourcesToDir({
		workspace: {
			// stub byGlobSource
			byGlobSource: (pattern) => {
				return Promise.resolve([]);
			}
		},
		pattern: "",
		targetPath: "/some/target/path"
	});

	t.deepEqual(createAdapterStub.getCall(0).args[0], {
		fsBasePath: "/some/target/path",
		virBasePath: "/resources/"
	}, "createAdapter called with correct arguments");
});

// test.serial("generateJsdoc", async (t) => {

// });

test.serial("generateJsdoc missing parameters", async (t) => {
	const error = await t.throws(generateJsdoc());
	t.deepEqual(error.message, "[generateJsdoc]: One or more mandatory options not provided",
		"Correct error message thrown");
});
