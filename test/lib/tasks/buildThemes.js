import test from "ava";
import sinon from "sinon";
import esmock from "esmock";
let buildThemes;

test.before(async () => {
	// Enable verbose logging to also cover verbose logging code
	const {setLogLevel} = await import("@ui5/logger");
	setLogLevel("verbose");
});

test.beforeEach(async (t) => {
	// Stubbing processors/themeBuilder
	t.context.themeBuilderStub = sinon.stub();
	t.context.fsInterfaceStub = sinon.stub();
	t.context.fsInterfaceStub.returns({});

	t.context.ReaderCollectionPrioritizedStub = sinon.stub();
	t.context.comboByGlob = sinon.stub().resolves([]);
	t.context.ReaderCollectionPrioritizedStub.returns({byGlob: t.context.comboByGlob});

	buildThemes = await esmock.p("../../../lib/tasks/buildThemes.js", {
		"@ui5/fs/fsInterface": t.context.fsInterfaceStub,
		"@ui5/fs/ReaderCollectionPrioritized": t.context.ReaderCollectionPrioritizedStub,
		"../../../lib/processors/themeBuilderWorker": t.context.themeBuilderStub
	});
});

test.afterEach.always((t) => {
	esmock.purge(buildThemes);
	sinon.restore();
});

test.serial("buildThemes", async (t) => {
	t.plan(4);

	const lessResource = {
		getPath: sinon.stub().returns("/resources/test/library.source.less"),
		getBuffer: sinon.stub().returns(new Buffer("/** test comment */"))
	};

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

	const cssResource = {path: "/cssResource", transferable: new Uint8Array(2)};
	const cssRtlResource = {path: "/cssRtlResource", transferable: new Uint8Array(2)};
	const jsonParametersResource = {path: "/jsonParametersResource", transferable: new Uint8Array(2)};

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

	t.is(t.context.themeBuilderStub.callCount, 1,
		"Processor should be called once");

	t.deepEqual(
		t.context.themeBuilderStub.getCall(0).args[0].options,
		{compress: true, cssVariables: false}, "Processor should be called with expected arguments");

	t.is(t.context.themeBuilderStub.getCall(0).args[0].themeResources.length,
		1, "Processor should be called with expected arguments");

	t.is(workspace.write.callCount, 3,
		"workspace.write should be called 3 times");
});


test.serial("buildThemes (compress = false)", async (t) => {
	t.plan(4);

	const lessResource = {
		getPath: sinon.stub().returns("/resources/test/library.source.less"),
		getBuffer: sinon.stub().returns(new Buffer("/** test comment */"))
	};

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

	const cssResource = {path: "/cssResource", transferable: new Uint8Array(2)};
	const cssRtlResource = {path: "/cssRtlResource", transferable: new Uint8Array(2)};
	const jsonParametersResource = {path: "/jsonParametersResource", transferable: new Uint8Array(2)};

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

	t.is(t.context.themeBuilderStub.callCount, 1,
		"Processor should be called once");

	t.deepEqual(t.context.themeBuilderStub.getCall(0).args[0].options,
		{compress: false, cssVariables: false}, "Processor should be called with expected arguments");

	t.is(t.context.themeBuilderStub.getCall(0).args[0].themeResources.length,
		1, "Processor should be called with expected arguments");

	t.is(workspace.write.callCount, 3,
		"workspace.write should be called 3 times");
});

test.serial("buildThemes (cssVariables = true)", async (t) => {
	t.plan(4);

	const lessResource = {
		getPath: sinon.stub().returns("/resources/test/library.source.less"),
		getBuffer: sinon.stub().returns(new Buffer("/** test comment */"))
	};

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

	const cssResource = {path: "/cssResource", transferable: new Uint8Array(2)};
	const cssRtlResource = {path: "/cssRtlResource", transferable: new Uint8Array(2)};
	const jsonParametersResource = {path: "/jsonParametersResource", transferable: new Uint8Array(2)};
	const cssVariablesSourceResource = {path: "/cssVariablesSourceResource", transferable: new Uint8Array(2)};
	const cssVariablesResource = {path: "/cssVariablesResource", transferable: new Uint8Array(2)};
	const cssSkeletonResource = {path: "/cssSkeletonResource", transferable: new Uint8Array(2)};
	const cssSkeletonRtlResource = {path: "/cssSkeletonRtlResource", transferable: new Uint8Array(2)};

	t.context.themeBuilderStub.returns([
		cssResource,
		cssRtlResource,
		jsonParametersResource,
		cssVariablesSourceResource,
		cssVariablesResource,
		cssSkeletonResource,
		cssSkeletonRtlResource
	]);

	await buildThemes({
		workspace,
		options: {
			projectName: "sap.ui.demo.app",
			inputPattern: "/resources/test/library.source.less",
			cssVariables: true
		}
	});

	t.is(t.context.themeBuilderStub.callCount, 1,
		"Processor should be called once");

	t.deepEqual(t.context.themeBuilderStub.getCall(0).args[0].options,
		{compress: true, cssVariables: true}, "Processor should be called with expected arguments");

	t.is(t.context.themeBuilderStub.getCall(0).args[0].themeResources.length,
		1, "Processor should be called with expected arguments");

	t.is(workspace.write.callCount, 7,
		"workspace.write should be called 7 times");
});

test.serial("buildThemes (filtering libraries)", async (t) => {
	t.plan(4);

	const lessResources = {
		"sap/ui/lib1/themes/theme1/library.source.less": {
			getPath: sinon.stub().returns("/resources/sap/ui/lib1/themes/theme1/library.source.less"),
			getBuffer: sinon.stub().returns(new Buffer("/** test comment */"))
		},
		"sap/ui/lib2/themes/theme1/library.source.less": {
			getPath: sinon.stub().returns("/resources/sap/ui/lib2/themes/theme1/library.source.less"),
			getBuffer: sinon.stub().returns(new Buffer("/** test comment */"))
		},
		"sap/ui/lib3/themes/theme1/library.source.less": {
			getPath: sinon.stub().returns("/resources/sap/ui/lib3/themes/theme1/library.source.less"),
			getBuffer: sinon.stub().returns(new Buffer("/** test comment */"))
		}
	};

	const dotLibraryResources = {
		"sap/ui/lib1/.library": {
			getPath: sinon.stub().returns("/resources/sap/ui/lib1/.library")
		},
		"sap/ui/lib1/library.js": {
			getPath: sinon.stub().returns("/resources/sap/ui/lib1/library.js")
		},
		"sap/ui/lib3/library.js": {
			getPath: sinon.stub().returns("/resources/sap/ui/lib3/library.js")
		}
	};

	const workspaceByGlob = sinon.stub().resolves([]);
	const workspace = {
		byGlob: workspaceByGlob,
		write: sinon.stub()
	};

	workspaceByGlob
		.withArgs("/resources/**/themes/*/library.source.less").resolves([
			lessResources["sap/ui/lib1/themes/theme1/library.source.less"],
			lessResources["sap/ui/lib2/themes/theme1/library.source.less"],
			lessResources["sap/ui/lib3/themes/theme1/library.source.less"]
		]);

	t.context.comboByGlob
		.withArgs("/resources/**/(*.library|library.js)").resolves([
			dotLibraryResources["sap/ui/lib1/.library"],
			dotLibraryResources["sap/ui/lib1/library.js"],
			dotLibraryResources["sap/ui/lib3/library.js"]
		]);

	t.context.themeBuilderStub.returns([
		{path: "/resource", transferable: new Uint8Array(2)}
	]);

	await buildThemes({
		workspace,
		options: {
			projectName: "sap.ui.test.lib1",
			inputPattern: "/resources/**/themes/*/library.source.less",
			librariesPattern: "/resources/**/(*.library|library.js)"
		}
	});

	t.is(t.context.themeBuilderStub.callCount, 2,
		"Processor should be called once");

	t.deepEqual(t.context.themeBuilderStub.getCall(0).args[0].options,
		{compress: true, cssVariables: false}, "Processor should be called with expected arguments");

	t.is(t.context.themeBuilderStub.getCall(0).args[0].themeResources.length,
		1, "Processor should be called with expected arguments");

	t.is(workspace.write.callCount, 2,
		"workspace.write should be called once");
});

test.serial("buildThemes (filtering themes)", async (t) => {
	t.plan(4);

	const lessResources = {
		"sap/ui/lib1/themes/theme1/library.source.less": {
			getPath: sinon.stub().returns("/resources/sap/ui/lib1/themes/theme1/library.source.less"),
			getBuffer: sinon.stub().returns(new Buffer("/** test comment */"))
		},
		"sap/ui/lib1/themes/theme2/library.source.less": {
			getPath: sinon.stub().returns("/resources/sap/ui/lib1/themes/theme2/library.source.less"),
			getBuffer: sinon.stub().returns(new Buffer("/** test comment */"))
		},
		"sap/ui/lib1/themes/theme3/library.source.less": {
			getPath: sinon.stub().returns("/resources/sap/ui/lib1/themes/theme3/library.source.less"),
			getBuffer: sinon.stub().returns(new Buffer("/** test comment */"))
		}
	};

	const baseThemes = {
		"sap/ui/core/themes/theme1/": {
			getPath: sinon.stub().returns("/resources/sap/ui/core/themes/theme1/"),
			getStatInfo: () => {
				return {isDirectory: () => true};
			}
		},
		"sap/ui/core/themes/theme3/": {
			getPath: sinon.stub().returns("/resources/sap/ui/core/themes/theme3/"),
			getStatInfo: () => {
				return {isDirectory: () => true};
			}
		}
	};

	const workspaceByGlob = sinon.stub().resolves([]);
	const workspace = {
		byGlob: workspaceByGlob,
		write: sinon.stub()
	};

	workspaceByGlob
		.withArgs("/resources/**/themes/*/library.source.less").resolves([
			lessResources["sap/ui/lib1/themes/theme1/library.source.less"],
			lessResources["sap/ui/lib1/themes/theme2/library.source.less"],
			lessResources["sap/ui/lib1/themes/theme3/library.source.less"]
		]);

	t.context.comboByGlob
		.withArgs("/resources/sap/ui/core/themes/*", {nodir: false}).resolves([
			baseThemes["sap/ui/core/themes/theme1/"],
			baseThemes["sap/ui/core/themes/theme3/"]
		]);

	t.context.themeBuilderStub.returns([
		{path: "/resource", transferable: new Uint8Array(2)}
	]);

	await buildThemes({
		workspace,
		options: {
			projectName: "sap.ui.test.lib1",
			inputPattern: "/resources/**/themes/*/library.source.less",
			themesPattern: "/resources/sap/ui/core/themes/*"
		}
	});

	t.is(t.context.themeBuilderStub.callCount, 2,
		"Processor should be called once");

	t.deepEqual(t.context.themeBuilderStub.getCall(0).args[0].options,
		{compress: true, cssVariables: false}, "Processor should be called with expected arguments");

	t.is(t.context.themeBuilderStub.getCall(0).args[0].themeResources.length,
		1, "Processor should be called with expected arguments");

	t.is(workspace.write.callCount, 2,
		"workspace.write should be called once");
});

test.serial("buildThemes (filtering libraries + themes)", async (t) => {
	t.plan(4);

	const lessResources = {
		"sap/ui/lib1/themes/theme1/library.source.less": {
			getPath: sinon.stub().returns("/resources/sap/ui/lib1/themes/theme1/library.source.less"),
			getBuffer: sinon.stub().returns(new Buffer("/** test comment */")),
		},
		"sap/ui/lib1/themes/theme2/library.source.less": {
			getPath: sinon.stub().returns("/resources/sap/ui/lib1/themes/theme2/library.source.less"),
			getBuffer: sinon.stub().returns(new Buffer("/** test comment */")),
		},
		"sap/ui/lib1/themes/theme3/library.source.less": {
			getPath: sinon.stub().returns("/resources/sap/ui/lib1/themes/theme3/library.source.less"),
			getBuffer: sinon.stub().returns(new Buffer("/** test comment */")),
		},
		"sap/ui/lib2/themes/theme1/library.source.less": {
			getPath: sinon.stub().returns("/resources/sap/ui/lib2/themes/theme1/library.source.less"),
			getBuffer: sinon.stub().returns(new Buffer("/** test comment */")),
		},
		"sap/ui/lib2/themes/theme2/library.source.less": {
			getPath: sinon.stub().returns("/resources/sap/ui/lib2/themes/theme2/library.source.less"),
			getBuffer: sinon.stub().returns(new Buffer("/** test comment */")),
		},
		"sap/ui/lib2/themes/theme3/library.source.less": {
			getPath: sinon.stub().returns("/resources/sap/ui/lib2/themes/theme3/library.source.less"),
			getBuffer: sinon.stub().returns(new Buffer("/** test comment */")),
		},
		"sap/ui/lib3/themes/theme1/library.source.less": {
			getPath: sinon.stub().returns("/resources/sap/ui/lib3/themes/theme1/library.source.less"),
			getBuffer: sinon.stub().returns(new Buffer("/** test comment */")),
		},
		"sap/ui/lib3/themes/theme2/library.source.less": {
			getPath: sinon.stub().returns("/resources/sap/ui/lib3/themes/theme2/library.source.less"),
			getBuffer: sinon.stub().returns(new Buffer("/** test comment */")),
		},
		"sap/ui/lib3/themes/theme3/library.source.less": {
			getPath: sinon.stub().returns("/resources/sap/ui/lib3/themes/theme3/library.source.less"),
			getBuffer: sinon.stub().returns(new Buffer("/** test comment */")),
		}
	};

	const dotLibraryResources = {
		"sap/ui/lib1/.library": {
			getPath: sinon.stub().returns("/resources/sap/ui/lib1/.library")
		},
		"sap/ui/lib1/library.js": {
			getPath: sinon.stub().returns("/resources/sap/ui/lib1/library.js")
		},
		"sap/ui/lib3/library.js": {
			getPath: sinon.stub().returns("/resources/sap/ui/lib3/library.js")
		}
	};

	const baseThemes = {
		"sap/ui/core/themes/theme1/": {
			getPath: sinon.stub().returns("/resources/sap/ui/core/themes/theme1/"),
			getStatInfo: () => {
				return {isDirectory: () => true};
			}
		},
		"sap/ui/core/themes/theme3/": {
			getPath: sinon.stub().returns("/resources/sap/ui/core/themes/theme3/"),
			getStatInfo: () => {
				return {isDirectory: () => true};
			}
		}
	};

	const workspaceByGlob = sinon.stub().resolves([]);
	const workspace = {
		byGlob: workspaceByGlob,
		write: sinon.stub()
	};

	workspaceByGlob
		.withArgs("/resources/**/themes/*/library.source.less").resolves([
			lessResources["sap/ui/lib1/themes/theme1/library.source.less"],
			lessResources["sap/ui/lib1/themes/theme2/library.source.less"],
			lessResources["sap/ui/lib1/themes/theme3/library.source.less"],
			lessResources["sap/ui/lib2/themes/theme1/library.source.less"],
			lessResources["sap/ui/lib2/themes/theme2/library.source.less"],
			lessResources["sap/ui/lib2/themes/theme3/library.source.less"],
			lessResources["sap/ui/lib3/themes/theme1/library.source.less"],
			lessResources["sap/ui/lib3/themes/theme2/library.source.less"],
			lessResources["sap/ui/lib3/themes/theme3/library.source.less"]
		]);

	t.context.comboByGlob
		.withArgs("/resources/**/(*.library|library.js)").resolves([
			dotLibraryResources["sap/ui/lib1/.library"],
			dotLibraryResources["sap/ui/lib1/library.js"],
			dotLibraryResources["sap/ui/lib3/library.js"]
		])
		.withArgs("/resources/sap/ui/core/themes/*", {nodir: false}).resolves([
			baseThemes["sap/ui/core/themes/theme1/"],
			baseThemes["sap/ui/core/themes/theme3/"]
		]);

	t.context.themeBuilderStub.returns([{
		path: "/resources/sap/ui/lib1/themes/theme1/library.source.less",
		transferable: new Uint8Array(2),
	}]);

	await buildThemes({
		workspace,
		options: {
			projectName: "sap.ui.test.lib1",
			inputPattern: "/resources/**/themes/*/library.source.less",
			librariesPattern: "/resources/**/(*.library|library.js)",
			themesPattern: "/resources/sap/ui/core/themes/*"
		}
	});

	t.is(t.context.themeBuilderStub.callCount, 4,
		"Processor should be called once");

	t.deepEqual(t.context.themeBuilderStub.getCall(0).args[0].options, {
		compress: true, cssVariables: false}, "Processor should be called with expected arguments");
	t.is(t.context.themeBuilderStub.getCall(0).args[0].themeResources.length,
		1, "Processor should be called with expected arguments");

	t.is(workspace.write.callCount, 4,
		"workspace.write should be called once");
});
