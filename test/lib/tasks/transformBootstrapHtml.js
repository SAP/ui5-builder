import test from "ava";
import sinon from "sinon";
import esmock from "esmock";
import transformBootstrapHtml from "../../../lib/tasks/transformBootstrapHtml.js";

test.beforeEach((t) => {
	// Spying logger of tasks/transformBootstrapHtml
	const log = require("@ui5/logger");
	const loggerInstance = log.getLogger("builder:tasks:transformBootstrapHtml");
	esmock("@ui5/logger", {
		getLogger: () => loggerInstance
	});
	esmock.reRequire("@ui5/logger");
	t.context.logWarnSpy = sinon.spy(loggerInstance, "warn");

	// Stubbing processors/bootstrapHtmlTransformer
	t.context.bootstrapHtmlTransformerStub = sinon.stub();
	esmock("../../../lib/processors/bootstrapHtmlTransformer", t.context.bootstrapHtmlTransformerStub);

	// Re-require tested module
	transformBootstrapHtml = esmock.reRequire("../../../lib/tasks/transformBootstrapHtml");
});

test.afterEach.always((t) => {
	esmock.stop("@ui5/logger");
	esmock.stop("../../../lib/processors/bootstrapHtmlTransformer");
	t.context.logWarnSpy.restore();
});

test.serial("Transforms index.html resource", async (t) => {
	t.plan(5);

	const resource = {};

	const workspace = {
		byPath: (actualPath) => {
			t.is(actualPath, "/resources/sap/ui/demo/app/index.html",
				"Reads index.html file from application namespace.");
			return Promise.resolve(resource);
		},
		write: (actualResource) => {
			t.deepEqual(actualResource, resource,
				"Expected resource is written back to workspace");
		}
	};

	t.context.bootstrapHtmlTransformerStub.returns([resource]);

	await transformBootstrapHtml({
		workspace,
		options: {
			projectName: "sap.ui.demo.app",
			namespace: "sap/ui/demo/app"
		}
	});

	t.is(t.context.bootstrapHtmlTransformerStub.callCount, 1,
		"Processor should be called once");

	t.true(t.context.bootstrapHtmlTransformerStub.calledWithExactly({
		resources: [resource],
		options: {
			src: "resources/sap-ui-custom.js"
		}
	}), "Processor should be called with expected arguments");

	t.true(t.context.logWarnSpy.notCalled, "No warnings should be logged");
});

test.serial("Transforms index.html resource without namespace", async (t) => {
	t.plan(5);

	const resource = {};

	const workspace = {
		byPath: (actualPath) => {
			t.is(actualPath, "/index.html",
				"Reads index.html file from application namespace.");
			return Promise.resolve(resource);
		},
		write: (actualResource) => {
			t.deepEqual(actualResource, resource,
				"Expected resource is written back to workspace");
		}
	};

	t.context.bootstrapHtmlTransformerStub.returns([resource]);

	await transformBootstrapHtml({
		workspace,
		options: {
			projectName: "sap.ui.demo.app"
		}
	});

	t.is(t.context.bootstrapHtmlTransformerStub.callCount, 1,
		"Processor should be called once");

	t.true(t.context.bootstrapHtmlTransformerStub.calledWithExactly({
		resources: [resource],
		options: {
			src: "resources/sap-ui-custom.js"
		}
	}), "Processor should be called with expected arguments");

	t.true(t.context.logWarnSpy.notCalled, "No warnings should be logged");
});

test.serial("No index.html resource exists", async (t) => {
	t.plan(4);

	const workspace = {
		byPath: (actualPath) => {
			t.is(actualPath, "/resources/sap/ui/demo/app/index.html",
				"Reads index.html file from application namespace.");
			return Promise.resolve(null);
		},
		write: () => {
			t.fail("No resources should be written to workspace");
		}
	};

	await transformBootstrapHtml({
		workspace,
		options: {
			projectName: "sap.ui.demo.app",
			namespace: "sap/ui/demo/app"
		}
	});

	t.true(t.context.bootstrapHtmlTransformerStub.notCalled,
		"Processor should not be called");

	t.is(t.context.logWarnSpy.callCount, 1, "One warning should be logged");
	t.true(
		t.context.logWarnSpy.calledWith(
			`Skipping bootstrap transformation due to missing index.html in project "sap.ui.demo.app".`),
		"Warning about missing index.html file should be logged");
});
