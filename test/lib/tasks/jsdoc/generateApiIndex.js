import test from "ava";
import sinon from "sinon";
import esmock from "esmock";
import generateApiIndex from "../../../../lib/tasks/jsdoc/generateApiIndex.js";

test.afterEach.always((t) => {
	esmock.stopAll();
	sinon.restore();
});

test.serial("generateApiIndex", async (t) => {
	const apiIndexGeneratorStub = sinon.stub().resolves(["resource A", "resource B"]);
	// mock with esmock
	const fsInterfaceStub = sinon.stub().returns("custom fs");
	esmock("../../../../lib/processors/jsdoc/apiIndexGenerator", apiIndexGeneratorStub);

	class ReaderCollectionPrioritizedStubClass {
		constructor(parameters) {
			t.deepEqual(parameters, {
				name: "generateApiIndex - workspace + dependencies: some.project",
				readers: [workspace, dependencies]
			}, "ReaderCollectionPrioritized got called with the correct arguments");
		}
	}

	esmock("@ui5/fs", {
		ReaderCollectionPrioritized: ReaderCollectionPrioritizedStubClass,
		fsInterface: fsInterfaceStub
	});
	const generateApiIndex = esmock.reRequire("../../../../lib/tasks/jsdoc/generateApiIndex");

	const writeStub = sinon.stub().resolves();
	const workspace = {
		write: writeStub
	};
	const dependencies = {};
	await generateApiIndex({
		workspace,
		dependencies,
		options: {
			projectName: "some.project"
		}
	});

	t.is(fsInterfaceStub.callCount, 1, "fsInterface got called once");
	t.true(fsInterfaceStub.getCall(0).args[0] instanceof ReaderCollectionPrioritizedStubClass,
		"fsInterface got called with an instance of ReaderCollectionPrioritizedStubClass");

	t.is(apiIndexGeneratorStub.callCount, 1, "apiIndexGenerator processor got called once");
	t.deepEqual(apiIndexGeneratorStub.getCall(0).args[0], {
		versionInfoPath: "/resources/sap-ui-version.json",
		testResourcesRootPath: "/test-resources",
		targetApiIndexPath: "/docs/api/api-index.json",
		targetApiIndexDeprecatedPath: "/docs/api/api-index-deprecated.json",
		targetApiIndexExperimentalPath: "/docs/api/api-index-experimental.json",
		targetApiIndexSincePath: "/docs/api/api-index-since.json",
		fs: "custom fs"
	}, "apiIndexGenerator got called with correct arguments");

	t.is(writeStub.callCount, 2, "Write got called twice");
	t.is(writeStub.getCall(0).args[0], "resource A", "Write got called with correct arguments");
	t.is(writeStub.getCall(1).args[0], "resource B", "Write got called with correct arguments");
});

test("generateApiIndex with missing parameters", async (t) => {
	await t.throwsAsync(generateApiIndex(), {
		instanceOf: TypeError
	}, "TypeError thrown");
});
