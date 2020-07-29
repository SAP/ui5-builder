const test = require("ava");
const sinon = require("sinon");
const mock = require("mock-require");

test.beforeEach((t) => {
	t.context.workspace = {
		byGlob: sinon.stub().resolves([]),
		write: sinon.stub().resolves()
	};
	t.context.dependencies = {};
	t.context.comboByGlob = sinon.stub().resolves([]);

	t.context.ReaderCollectionPrioritizedStub = sinon.stub();
	t.context.ReaderCollectionPrioritizedStub.returns({
		byGlob: t.context.comboByGlob
	});
	mock("@ui5/fs", {
		ReaderCollectionPrioritized: t.context.ReaderCollectionPrioritizedStub
	});

	t.context.moduleBundlerStub = sinon.stub().resolves([]);
	mock("../../../../lib/processors/bundlers/moduleBundler", t.context.moduleBundlerStub);

	t.context.generateLibraryPreload = mock.reRequire("../../../../lib/tasks/bundlers/generateLibraryPreload");
});

test.afterEach(() => {
	sinon.restore();
	mock.stopAll();
});

test.serial("generateLibraryPreload should call moduleBundler with expected arguments", async (t) => {
	const {
		generateLibraryPreload, moduleBundlerStub, ReaderCollectionPrioritizedStub,
		workspace, dependencies, comboByGlob
	} = t.context;

	const expectedResources = [{"fake": "resource"}];
	comboByGlob.resolves(expectedResources);

	workspace.byGlob.resolves([
		{getPath: sinon.stub().returns("/resources/my/lib/.library")}
	]);

	await generateLibraryPreload({
		workspace,
		dependencies,
		options: {
			projectName: "Test Library"
		}
	});

	t.is(moduleBundlerStub.callCount, 1, "moduleBundler should have been called once");
	t.deepEqual(moduleBundlerStub.getCall(0).args, [{
		options: {
			bundleDefinition: {
				defaultFileTypes: [
					".js",
					".fragment.xml",
					".view.xml",
					".properties",
					".json",
				],
				name: "my/lib/library-preload.js",
				sections: [
					{
						filters: [
							"my/lib/",
							"!my/lib/.library",
							"!my/lib/designtime/",
							"!my/lib/**/*.designtime.js",
							"!my/lib/**/*.support.js",
							"!my/lib/themes/",
							"!my/lib/messagebundle*",
						],
						mode: "preload",
						renderer: true,
						resolve: false,
						resolveConditional: false,
					}
				]
			},
			bundleOptions: {
				optimize: true,
				usePredefineCalls: true,
				ignoreMissingModules: true
			}
		},
		resources: [
			{"fake": "resource"}
		]
	}]);

	t.is(workspace.byGlob.callCount, 1,
		"workspace.byGlob should have been called once");
	t.deepEqual(workspace.byGlob.getCall(0).args, ["/resources/**/.library"],
		"workspace.byGlob should have been called with expected pattern");

	t.is(ReaderCollectionPrioritizedStub.callCount, 1,
		"ReaderCollectionPrioritized should have been called once");
	t.true(ReaderCollectionPrioritizedStub.calledWithNew(),
		"ReaderCollectionPrioritized should have been called with 'new'");
});
