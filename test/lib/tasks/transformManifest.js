import test from "ava";
import sinonGlobal from "sinon";
import esmock from "esmock";

test.beforeEach(async (t) => {
	const sinon = t.context.sinon = sinonGlobal.createSandbox();

	t.context.log = {
		warn: sinon.stub()
	};

	t.context.manifestTransformerStub = sinon.stub();

	t.context.transformManifest = await esmock("../../../lib/tasks/transformManifest.js", {
		"@ui5/logger": {
			getLogger: sinon.stub().withArgs("builder:tasks:transformManifest").returns(t.context.log)
		},
		"../../../lib/processors/manifestTransformer": t.context.manifestTransformerStub,
	});
});

test.afterEach.always((t) => {
	t.context.sinon.restore();
});

test.serial("Transforms manifest.json resource", async (t) => {
	const {transformManifest, log} = t.context;

	t.plan(5);

	const resource = {};

	const workspace = {
		byPath: (actualPath) => {
			t.is(actualPath, "/resources/sap/ui/demo/app/manifest.json",
				"Reads manifest.json file from application namespace.");
			return Promise.resolve(resource);
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
			projectName: "sap.ui.demo.app",
			namespace: "sap/ui/demo/app"
		}
	});

	t.is(t.context.manifestTransformerStub.callCount, 1,
		"Processor should be called once");

	t.true(t.context.manifestTransformerStub.calledWithExactly({
		resources: [resource],
		options: {
			noop: "Noop"
		}
	}), "Processor should be called with expected arguments");

	t.true(log.warn.notCalled, "No warnings should be logged");
});
