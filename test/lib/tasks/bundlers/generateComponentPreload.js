const test = require("ava");
const sinon = require("sinon");
const mock = require("mock-require");
const logger = require("@ui5/logger");

test.beforeEach((t) => {
	t.context.log = {
		warn: sinon.stub(),
		verbose: sinon.stub(),
		error: sinon.stub()
	};
	sinon.stub(logger, "getLogger").withArgs("builder:tasks:bundlers:generateComponentPreload").returns(t.context.log);

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

	t.context.moduleBundlerStub = sinon.stub().resolves([{"fake": "resource"}]);
	mock("../../../../lib/processors/bundlers/moduleBundler", t.context.moduleBundlerStub);

	t.context.generateComponentPreload = mock.reRequire("../../../../lib/tasks/bundlers/generateComponentPreload");
});

test.afterEach.always(() => {
	sinon.restore();
	mock.stopAll();
});

test.serial("generateComponentPreload - one namespace", async (t) => {
	const {
		generateComponentPreload, moduleBundlerStub, ReaderCollectionPrioritizedStub,
		workspace, dependencies, comboByGlob
	} = t.context;

	const resources = [
		{"fake": "resource"}
	];
	comboByGlob.resolves(resources);

	await generateComponentPreload({
		workspace,
		dependencies,
		options: {
			projectName: "Test Application",
			namespaces: ["my/app"]
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
				name: "my/app/Component-preload.js",
				sections: [
					{
						filters: [
							"my/app/",
							"!my/app/test/",
							"!my/app/*.html"
						],
						mode: "preload",
						renderer: false,
						resolve: false,
						resolveConditional: false,
					}
				]
			},
			bundleOptions: {
				optimize: true,
				ignoreMissingModules: true
			}
		},
		resources
	}]);

	t.is(comboByGlob.callCount, 1,
		"combo.byGlob should have been called once");
	t.deepEqual(comboByGlob.getCall(0).args, ["/resources/**/*.{js,json,xml,html,properties,library}"],
		"combo.byGlob should have been called with expected pattern");

	t.is(ReaderCollectionPrioritizedStub.callCount, 1,
		"ReaderCollectionPrioritized should have been called once");
	t.true(ReaderCollectionPrioritizedStub.calledWithNew(),
		"ReaderCollectionPrioritized should have been called with 'new'");

	const bundleResources = await moduleBundlerStub.getCall(0).returnValue;
	t.is(workspace.write.callCount, 1,
		"workspace.write should have been called once");
	t.deepEqual(workspace.write.getCall(0).args, [bundleResources[0]],
		"workspace.write should have been called with expected args");
	t.is(workspace.write.getCall(0).args[0], bundleResources[0],
		"workspace.write should have been called with exact resource returned by moduleBundler");
});

test.serial("generateComponentPreload - one namespace - excludes", async (t) => {
	const {
		generateComponentPreload, moduleBundlerStub, ReaderCollectionPrioritizedStub,
		workspace, dependencies, comboByGlob
	} = t.context;

	const resources = [
		{"fake": "resource"}
	];
	comboByGlob.resolves(resources);

	await generateComponentPreload({
		workspace,
		dependencies,
		options: {
			projectName: "Test Application",
			namespaces: ["my/app"],
			excludes: [
				"my/app/thirdparty/",
				"!my/app/thirdparty/NotExcluded.js"
			]
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
				name: "my/app/Component-preload.js",
				sections: [
					{
						filters: [
							"my/app/",
							"!my/app/test/",
							"!my/app/*.html",
							"!my/app/thirdparty/",
							"my/app/thirdparty/NotExcluded.js"
						],
						mode: "preload",
						renderer: false,
						resolve: false,
						resolveConditional: false,
					}
				]
			},
			bundleOptions: {
				optimize: true,
				ignoreMissingModules: true
			}
		},
		resources
	}]);

	t.is(comboByGlob.callCount, 1,
		"combo.byGlob should have been called once");
	t.deepEqual(comboByGlob.getCall(0).args, ["/resources/**/*.{js,json,xml,html,properties,library}"],
		"combo.byGlob should have been called with expected pattern");

	t.is(ReaderCollectionPrioritizedStub.callCount, 1,
		"ReaderCollectionPrioritized should have been called once");
	t.true(ReaderCollectionPrioritizedStub.calledWithNew(),
		"ReaderCollectionPrioritized should have been called with 'new'");

	const bundleResources = await moduleBundlerStub.getCall(0).returnValue;
	t.is(workspace.write.callCount, 1,
		"workspace.write should have been called once");
	t.deepEqual(workspace.write.getCall(0).args, [bundleResources[0]],
		"workspace.write should have been called with expected args");
	t.is(workspace.write.getCall(0).args[0], bundleResources[0],
		"workspace.write should have been called with exact resource returned by moduleBundler");
});

test.serial("generateComponentPreload - multiple namespaces - excludes", async (t) => {
	const {
		generateComponentPreload, moduleBundlerStub, ReaderCollectionPrioritizedStub,
		workspace, dependencies, comboByGlob
	} = t.context;

	const resources = [
		{"fake": "resource"}
	];
	comboByGlob.resolves(resources);

	await generateComponentPreload({
		workspace,
		dependencies,
		options: {
			projectName: "Test Application",
			namespaces: [
				"my/app1",
				"my/app2"
			],
			excludes: [
				"my/app1/thirdparty1/",
				"!my/app1/thirdparty1/NotExcluded.js",
				"my/app2/thirdparty2/",
				"!my/app2/thirdparty2/NotExcluded.js"
			]
		}
	});

	t.is(moduleBundlerStub.callCount, 2, "moduleBundler should have been called twice");
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
				name: "my/app1/Component-preload.js",
				sections: [
					{
						filters: [
							"my/app1/",
							"!my/app1/test/",
							"!my/app1/*.html",
							"!my/app1/thirdparty1/",
							"my/app1/thirdparty1/NotExcluded.js",
							"!my/app2/thirdparty2/", // TODO: is this really expected?
						],
						mode: "preload",
						renderer: false,
						resolve: false,
						resolveConditional: false,
					}
				]
			},
			bundleOptions: {
				optimize: true,
				ignoreMissingModules: true
			}
		},
		resources
	}]);
	t.deepEqual(moduleBundlerStub.getCall(1).args, [{
		options: {
			bundleDefinition: {
				defaultFileTypes: [
					".js",
					".fragment.xml",
					".view.xml",
					".properties",
					".json",
				],
				name: "my/app2/Component-preload.js",
				sections: [
					{
						filters: [
							"my/app2/",
							"!my/app2/test/",
							"!my/app2/*.html",
							"!my/app1/thirdparty1/", // TODO: is this really expected?
							"!my/app2/thirdparty2/",
							"my/app2/thirdparty2/NotExcluded.js"
						],
						mode: "preload",
						renderer: false,
						resolve: false,
						resolveConditional: false,
					}
				]
			},
			bundleOptions: {
				optimize: true,
				ignoreMissingModules: true
			}
		},
		resources
	}]);

	t.is(comboByGlob.callCount, 1,
		"combo.byGlob should have been called once");
	t.deepEqual(comboByGlob.getCall(0).args, ["/resources/**/*.{js,json,xml,html,properties,library}"],
		"combo.byGlob should have been called with expected pattern");

	t.is(ReaderCollectionPrioritizedStub.callCount, 1,
		"ReaderCollectionPrioritized should have been called once");
	t.true(ReaderCollectionPrioritizedStub.calledWithNew(),
		"ReaderCollectionPrioritized should have been called with 'new'");

	const bundleResources1 = await moduleBundlerStub.getCall(0).returnValue;
	const bundleResources2 = await moduleBundlerStub.getCall(1).returnValue;
	t.is(workspace.write.callCount, 2,
		"workspace.write should have been called twice");
	t.deepEqual(workspace.write.getCall(0).args, [bundleResources1[0]],
		"workspace.write should have been called with expected args");
	t.is(workspace.write.getCall(0).args[0], bundleResources1[0],
		"workspace.write should have been called with exact resource returned by moduleBundler");
	t.deepEqual(workspace.write.getCall(1).args, [bundleResources2[0]],
		"workspace.write should have been called with expected args");
	t.is(workspace.write.getCall(1).args[0], bundleResources2[0],
		"workspace.write should have been called with exact resource returned by moduleBundler");
});

test.serial("generateComponentPreload - one namespace - invalid exclude", async (t) => {
	const {
		generateComponentPreload,
		workspace, dependencies, comboByGlob,
		log
	} = t.context;

	const resources = [
		{"fake": "resource"}
	];
	comboByGlob.resolves(resources);

	await generateComponentPreload({
		workspace,
		dependencies,
		options: {
			projectName: "Test Application",
			namespaces: ["my/app"],
			excludes: [
				"!**/" // re-include outside of namespace is not allowed
			]
		}
	});

	t.is(log.warn.callCount, 1, "log.warn should be called once");
	t.deepEqual(log.warn.getCall(0).args, [
		"Unused exclude: **/"
	]);

	t.is(log.verbose.callCount, 1, "log.verbose should be called once");
	t.deepEqual(log.verbose.getCall(0).args, [
		"Generating my/app/Component-preload.js..."
	]);

	t.is(log.error.callCount, 0, "log.error should not be called");
});
