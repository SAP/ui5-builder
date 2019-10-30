const test = require("ava");

const sinon = require("sinon");
const mock = require("mock-require");

let buildThemes = require("../../../lib/tasks/buildThemes");

test.beforeEach((t) => {
	// Stubbing processors/themeBuilder
	t.context.themeBuilderStub = sinon.stub();
	t.context.cssOptimizerStub = sinon.stub();
	t.context.fsInterfaceStub = sinon.stub(require("@ui5/fs"), "fsInterface");
	t.context.fsInterfaceStub.returns({});
	mock("../../../lib/processors/themeBuilder", t.context.themeBuilderStub);
	mock("../../../lib/processors/cssOptimizer", t.context.cssOptimizerStub);

	// Re-require tested module
	buildThemes = mock.reRequire("../../../lib/tasks/buildThemes");
});

test.afterEach.always((t) => {
	t.context.fsInterfaceStub.restore();
	mock.stop("../../../lib/processors/themeBuilder");
	mock.stop("../../../lib/processors/cssOptimizer");
});

test.serial("buildThemes", async (t) => {
	t.plan(8);

	const lessResource = {};

	const workspace = {
		byGlob: async (globPattern) => {
			if (globPattern === "/resources/test/library.source.less") {
				return [lessResource];
			} else {
				return [];
			}
		},
		write: sinon.stub()
	};

	const cssResource = {getPath: () => "fu.css"};
	const cssRtlResource = {getPath: () => "fu-rtl.css"};
	const jsonParametersResource = {getPath: () => "fu.json"};

	t.context.themeBuilderStub.returns([
		cssResource,
		cssRtlResource,
		jsonParametersResource
	]);

	await buildThemes({
		workspace,
		options: {
			projectName: "sap.ui.demo.app",
			inputPattern: "/resources/test/library.source.less"
		}
	});

	t.deepEqual(t.context.themeBuilderStub.callCount, 1,
		"Theme Builder should be called once");

	t.deepEqual(t.context.themeBuilderStub.getCall(0).args[0], {
		resources: [lessResource],
		fs: {},
		options: {
			compressJSON: true, // default
			compress: false
		}
	}, "Theme Builder should be called with expected arguments");

	t.deepEqual(t.context.cssOptimizerStub.callCount, 1, "CSS Optimizer should be called once");
	t.deepEqual(t.context.cssOptimizerStub.getCall(0).args[0], {
		resources: [cssResource, cssRtlResource],
		fs: {}
	}, "CSS Optimizer should be called with expected arguments");

	t.deepEqual(workspace.write.callCount, 3,
		"workspace.write should be called 3 times");
	t.true(workspace.write.calledWithExactly(cssResource));
	t.true(workspace.write.calledWithExactly(cssRtlResource));
	t.true(workspace.write.calledWithExactly(jsonParametersResource));
});


test.serial("buildThemes (compress = false)", async (t) => {
	t.plan(7);

	const lessResource = {};

	const workspace = {
		byGlob: async (globPattern) => {
			if (globPattern === "/resources/test/library.source.less") {
				return [lessResource];
			} else {
				return [];
			}
		},
		write: sinon.stub()
	};

	const cssResource = {getPath: () => "fu.css"};
	const cssRtlResource = {getPath: () => "fu-rtl.css"};
	const jsonParametersResource = {getPath: () => "fu.json"};

	t.context.themeBuilderStub.returns([
		cssResource,
		cssRtlResource,
		jsonParametersResource
	]);

	await buildThemes({
		workspace,
		options: {
			projectName: "sap.ui.demo.app",
			inputPattern: "/resources/test/library.source.less",
			compress: false
		}
	});

	t.deepEqual(t.context.themeBuilderStub.callCount, 1,
		"Theme Builder should be called once");

	t.deepEqual(t.context.themeBuilderStub.getCall(0).args[0], {
		resources: [lessResource],
		fs: {},
		options: {
			compressJSON: false,
			compress: false
		}
	}, "Theme Builder should be called with expected arguments");

	t.deepEqual(t.context.cssOptimizerStub.callCount, 0, "CSS Optimizer should not be called");

	t.deepEqual(workspace.write.callCount, 3,
		"workspace.write should be called 3 times");
	t.true(workspace.write.calledWithExactly(cssResource));
	t.true(workspace.write.calledWithExactly(cssRtlResource));
	t.true(workspace.write.calledWithExactly(jsonParametersResource));
});
