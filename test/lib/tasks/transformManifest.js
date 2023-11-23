import test from "ava";
import sinonGlobal from "sinon";
import esmock from "esmock";

test.beforeEach(async (t) => {
	const sinon = t.context.sinon = sinonGlobal.createSandbox();

	t.context.log = {
		warn: sinon.stub(),
		error: sinon.stub()
	};

	t.context.manifestTransformerStub = sinon.stub();
	t.context.fsInterfaceStub = sinon.stub().returns("fs interface");
	t.context.transformManifest = await esmock("../../../lib/tasks/transformManifest.js", {
		"@ui5/logger": {
			getLogger: sinon.stub().withArgs("builder:tasks:transformManifest").returns(t.context.log)
		},
		"@ui5/fs/fsInterface": t.context.fsInterfaceStub,
		"../../../lib/processors/manifestTransformer": t.context.manifestTransformerStub,
	});
});

test.afterEach.always((t) => {
	t.context.sinon.restore();
});

test.serial("Transforms manifest.json resource", async (t) => {
	const {transformManifest, log} = t.context;

	t.plan(6);

	const resource = {};

	const workspace = {
		byGlob: (actualPath) => {
			t.is(actualPath, "/resources/sap/ui/demo/app/**/manifest.json",
				"Reads all manifest.json files");
			return Promise.resolve([resource]);
		},
		write: (actualResource) => {
			t.deepEqual(actualResource, resource,
				"Expected resource is written back to workspace");
		}
	};

	t.context.manifestTransformerStub.returns([resource]);

	await transformManifest({
		workspace,
		options: {
			projectNamespace: "sap/ui/demo/app"
		}
	});

	t.is(t.context.manifestTransformerStub.callCount, 1,
		"Processor should be called once");

	t.true(t.context.manifestTransformerStub.calledWithExactly({
		resources: [resource],
		fs: "fs interface",
		options: {
			projectNamespace: "sap/ui/demo/app"
		}
	}), "Processor should be called with expected arguments");

	t.true(log.warn.notCalled, "No warnings should be logged");
	t.true(log.error.notCalled, "No errors should be logged");
});

// test.serial("Should rewrite the manifest.json if no changes werde made", (t) => {

// });
