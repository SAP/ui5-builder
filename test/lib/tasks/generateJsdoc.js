const {test} = require("ava");
const sinon = require("sinon");
const tmp = require("tmp");

const mock = require("mock-require");

const generateJsdoc = require("../../../lib/tasks/generateJsdoc");

test.beforeEach((t) => {
	t.context.tmpStub = sinon.stub(tmp, "dir");
});

test.afterEach.always((t) => {
	sinon.restore();
});

test.serial("createTmpDir successful", async (t) => {
	t.context.tmpStub.callsArgWithAsync(1, undefined, "some/path");

	const res = await generateJsdoc._createTmpDir("som$e.nam3/space"); // non alphanum characters get removed

	t.deepEqual(t.context.tmpStub.callCount, 1, "Tmp dir is called once");
	t.deepEqual(t.context.tmpStub.getCall(0).args[0].prefix, "ui5-tooling-tmp-jsdoc-somenam3space-");
	t.deepEqual(res, {path: "some/path"}, "Correct path returned");
});

test.serial("createTmpDir error", async (t) => {
	t.context.tmpStub.callsArgWithAsync(1, {message: "Dir creation failed"}, "some/path");

	const res = await t.throws(generateJsdoc._createTmpDir("some.namespace"));

	t.deepEqual(t.context.tmpStub.callCount, 1, "Tmp dir is called once");
	t.deepEqual(t.context.tmpStub.getCall(0).args[0].prefix, "ui5-tooling-tmp-jsdoc-somenamespace-");
	t.deepEqual(res, {message: "Dir creation failed"}, "Dir creation failed");
});

test.serial("createTmpDirs", async (t) => {
	const makeDirStub = sinon.stub().resolves();
	mock("make-dir", makeDirStub);
	const generateJsdoc = mock.reRequire("../../../lib/tasks/generateJsdoc");

	t.context.tmpStub.callsArgWithAsync(1, undefined, "/some/path");

	const res = await generateJsdoc._createTmpDirs("some.namespace");

	t.deepEqual(res, {sourcePath: "/some/path/src", targetPath: "/some/path/target", tmpPath: "/some/path/tmp"},
		"Correct temporary directories returned");
	t.deepEqual(makeDirStub.callCount, 1, "One directory got created");
	t.deepEqual(makeDirStub.getCall(0).args[0], "/some/path/tmp", "Correct dir path got created");

	mock.stop("make-dir");
});

test.serial("writeResourcesToDir with byGlobSource", async (t) => {
	const writeStub = sinon.stub().resolves();
	const createAdapterStub = sinon.stub(require("@ui5/fs").resourceFactory, "createAdapter").returns({
		write: writeStub
	});

	await generateJsdoc._writeResourcesToDir({
		workspace: {
			// stub byGlobSource
			byGlobSource: (pattern) => {
				t.deepEqual(pattern, "some pattern", "Glob with correct pattern");
				return Promise.resolve(["resource A", "resource B"]);
			}
		},
		pattern: "some pattern",
		targetPath: "/some/target/path"
	});

	t.deepEqual(createAdapterStub.getCall(0).args[0], {
		fsBasePath: "/some/target/path",
		virBasePath: "/resources/"
	}, "createAdapter called with correct arguments");

	t.deepEqual(writeStub.callCount, 2, "Write got called twice");
	t.deepEqual(writeStub.getCall(0).args[0], "resource A", "Write got called with correct arguments");
	t.deepEqual(writeStub.getCall(1).args[0], "resource B", "Write got called with correct arguments");
});

test.serial("writeResourcesToDir with byGlob", async (t) => {
	const writeStub = sinon.stub().resolves();
	const createAdapterStub = sinon.stub(require("@ui5/fs").resourceFactory, "createAdapter").returns({
		write: writeStub
	});

	await generateJsdoc._writeResourcesToDir({
		workspace: {
			// stub byGlobSource
			byGlob: (pattern) => {
				t.deepEqual(pattern, "some pattern", "Glob with correct pattern");
				return Promise.resolve(["resource A", "resource B"]);
			}
		},
		pattern: "some pattern",
		targetPath: "/some/target/path"
	});

	t.deepEqual(createAdapterStub.getCall(0).args[0], {
		fsBasePath: "/some/target/path",
		virBasePath: "/resources/"
	}, "createAdapter called with correct arguments");

	t.deepEqual(writeStub.callCount, 2, "Write got called twice");
	t.deepEqual(writeStub.getCall(0).args[0], "resource A", "Write got called with correct arguments");
	t.deepEqual(writeStub.getCall(1).args[0], "resource B", "Write got called with correct arguments");
});

test.serial("generateJsdoc", async (t) => {
	const jsdocGeneratorStub = sinon.stub().resolves(["some resource 1", "some resource 2"]);
	mock("../../../lib/processors/jsdoc/jsdocGenerator", jsdocGeneratorStub);
	const generateJsdoc = mock.reRequire("../../../lib/tasks/generateJsdoc");

	const createTmpDirsStub = sinon.stub(generateJsdoc, "_createTmpDirs").resolves({
		sourcePath: "/some/source/path",
		targetPath: "/some/target/path",
		tmpPath: "/some/tmp/path",
	});
	const writeResourcesToDirStub = sinon.stub(generateJsdoc, "_writeResourcesToDir").resolves();

	const writeStub = sinon.stub().resolves();
	const workspace = {
		write: writeStub
	};
	await generateJsdoc({
		workspace,
		options: {
			pattern: "some pattern",
			projectName: "some.project",
			version: "some version"
		}
	});

	t.deepEqual(createTmpDirsStub.callCount, 1, "createTmpDirs got called once");
	t.deepEqual(createTmpDirsStub.getCall(0).args[0], "some.project",
		"createTmpDirs got called with correct arguments");

	t.deepEqual(writeResourcesToDirStub.callCount, 1, "writeResourcesToDir got called once");
	t.deepEqual(writeResourcesToDirStub.getCall(0).args[0], {
		workspace,
		pattern: "some pattern",
		targetPath: "/some/source/path" // one's target is another one's source
	}, "writeResourcesToDir got called with correct arguments");

	t.deepEqual(jsdocGeneratorStub.callCount, 1, "jsdocGenerator processor got called once");
	t.deepEqual(jsdocGeneratorStub.getCall(0).args[0], {
		sourcePath: "/some/source/path",
		targetPath: "/some/target/path",
		tmpPath: "/some/tmp/path",
		options: {
			projectName: "some.project",
			version: "some version",
			variants: ["apijson"]
		}
	}, "jsdocGenerator got called with correct arguments");

	mock.stop("../../../lib/processors/jsdoc/jsdocGenerator");
});

test.serial("generateJsdoc missing parameters", async (t) => {
	const error = await t.throws(generateJsdoc());
	t.deepEqual(error.message, "[generateJsdoc]: One or more mandatory options not provided",
		"Correct error message thrown");
});
