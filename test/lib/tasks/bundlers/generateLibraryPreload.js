const test = require("ava");
const path = require("path");
const chai = require("chai");
chai.use(require("chai-fs"));
const fs = require("graceful-fs");
const {promisify} = require("util");
const readFile = promisify(fs.readFile);
const assert = chai.assert;
const sinon = require("sinon");
const mock = require("mock-require");

const ui5Builder = require("../../../../");
const builder = ui5Builder.builder;
const libraryDPath = path.join(__dirname, "..", "..", "..", "fixtures", "library.d");
const libraryNPath = path.join(__dirname, "..", "..", "..", "fixtures", "library.n");
const sapUiCorePath = path.join(__dirname, "..", "..", "..", "fixtures", "sap.ui.core");

const recursive = require("recursive-readdir");

const findFiles = (folder) => {
	return new Promise((resolve, reject) => {
		recursive(folder, (err, files) => {
			if (err) {
				reject(err);
			} else {
				resolve(files);
			}
		});
	});
};

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

test.afterEach.always(() => {
	sinon.restore();
	mock.stopAll();
});

test.serial("generateLibraryPreload", async (t) => {
	const {
		generateLibraryPreload, moduleBundlerStub, ReaderCollectionPrioritizedStub,
		workspace, dependencies, comboByGlob
	} = t.context;

	const resources = [
		{getPath: sinon.stub().returns("/resources/my/lib/.library")}
	];
	comboByGlob.resolves(resources);

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
		resources
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

test("generateLibraryPreload for sap.ui.core (w/o ui5loader.js)", async (t) => {
	const {
		generateLibraryPreload, moduleBundlerStub, ReaderCollectionPrioritizedStub,
		workspace, dependencies, comboByGlob
	} = t.context;

	const resources = [
		{getPath: sinon.stub().returns("/resources/sap/ui/core/.library")},
		{getPath: sinon.stub().returns("/resources/sap-ui-core.js")}
	];
	const filteredResources = [resources[0]]; // without sap-ui-core.js
	comboByGlob.resolves(resources);

	workspace.byGlob.resolves([
		{getPath: sinon.stub().returns("/resources/sap/ui/core/.library")}
	]);

	await generateLibraryPreload({
		workspace,
		dependencies,
		options: {
			projectName: "sap.ui.core"
		}
	});

	t.is(moduleBundlerStub.callCount, 5, "moduleBundler should have been called 5 times");
	t.deepEqual(moduleBundlerStub.getCall(0).args, [{
		options: {
			bundleDefinition: {
				name: "sap-ui-core.js",
				sections: [
					{
						filters: [
							"jquery.sap.global.js"
						],
						mode: "raw",
						resolve: true,
						sort: true,
						declareModules: false
					},
					{
						mode: "preload",
						filters: [
							"sap/ui/core/Core.js"
						],
						resolve: true
					},
					{
						mode: "require",
						filters: [
							"sap/ui/core/Core.js"
						]
					}
				]
			},
			bundleOptions: {
				optimize: true,
				decorateBootstrapModule: true,
				addTryCatchRestartWrapper: true,
				usePredefineCalls: true
			}
		},
		resources: filteredResources
	}]);
	t.deepEqual(moduleBundlerStub.getCall(1).args, [{
		options: {
			bundleDefinition: {
				name: "sap-ui-core-dbg.js",
				sections: [
					{
						filters: [
							"jquery.sap.global.js"
						],
						mode: "raw",
						resolve: true,
						sort: true,
						declareModules: false
					},
					{
						mode: "require",
						filters: [
							"sap/ui/core/Core.js"
						]
					}
				]
			},
			bundleOptions: {
				optimize: false,
				decorateBootstrapModule: false,
				addTryCatchRestartWrapper: false,
				usePredefineCalls: false
			}
		},
		resources: filteredResources
	}]);
	t.deepEqual(moduleBundlerStub.getCall(2).args, [{
		options: {
			bundleDefinition: {
				name: "sap-ui-core-nojQuery.js",
				sections: [
					{
						mode: "provided",
						filters: [
							"jquery-ui-core.js",
							"jquery-ui-datepicker.js",
							"jquery-ui-position.js",
							"sap/ui/thirdparty/jquery.js",
							"sap/ui/thirdparty/jquery/*",
							"sap/ui/thirdparty/jqueryui/*"
						]
					},
					{
						filters: [
							"jquery.sap.global.js"
						],
						mode: "raw",
						resolve: true,
						sort: true,
						declareModules: false
					},
					{
						mode: "preload",
						filters: [
							"sap/ui/core/Core.js"
						],
						resolve: true
					},
					{
						mode: "require",
						filters: [
							"sap/ui/core/Core.js"
						]
					}
				]
			},
			bundleOptions: {
				optimize: true,
				decorateBootstrapModule: true,
				addTryCatchRestartWrapper: true,
				usePredefineCalls: true
			}
		},
		resources: filteredResources
	}]);
	t.deepEqual(moduleBundlerStub.getCall(3).args, [{
		options: {
			bundleDefinition: {
				name: "sap-ui-core-nojQuery-dbg.js",
				sections: [
					{
						mode: "provided",
						filters: [
							"jquery-ui-core.js",
							"jquery-ui-datepicker.js",
							"jquery-ui-position.js",
							"sap/ui/thirdparty/jquery.js",
							"sap/ui/thirdparty/jquery/*",
							"sap/ui/thirdparty/jqueryui/*"
						]
					},
					{
						filters: [
							"jquery.sap.global.js"
						],
						mode: "raw",
						resolve: true,
						sort: true,
						declareModules: false
					},
					{
						mode: "require",
						filters: [
							"sap/ui/core/Core.js"
						]
					}
				]
			},
			bundleOptions: {
				optimize: false,
				decorateBootstrapModule: false,
				addTryCatchRestartWrapper: false,
				usePredefineCalls: false
			}
		},
		resources: filteredResources
	}]);
	t.deepEqual(moduleBundlerStub.getCall(4).args, [{
		options: {
			bundleDefinition: {
				defaultFileTypes: [
					".js",
					".fragment.xml",
					".view.xml",
					".properties",
					".json",
				],
				name: "sap/ui/core/library-preload.js",
				sections: [
					{
						filters: [
							"ui5loader-autoconfig.js",
							"sap/ui/core/Core.js",
						],
						mode: "provided",
						resolve: true,
					},
					{
						filters: [
							"sap/ui/core/",
							"!sap/ui/core/.library",
							"!sap/ui/core/designtime/",
							"!sap/ui/core/**/*.designtime.js",
							"!sap/ui/core/**/*.support.js",
							"!sap/ui/core/themes/",
							"!sap/ui/core/messagebundle*",

							"!sap/ui/core/cldr/",
							"*.js",
							"sap/base/",
							"sap/ui/base/",
							"sap/ui/dom/",
							"sap/ui/events/",
							"sap/ui/model/",
							"sap/ui/security/",
							"sap/ui/util/",
							"sap/ui/Global.js",
							"sap/ui/thirdparty/crossroads.js",
							"sap/ui/thirdparty/caja-htmlsanitizer.js",
							"sap/ui/thirdparty/hasher.js",
							"sap/ui/thirdparty/signals.js",
							"sap/ui/thirdparty/jquery-mobile-custom.js",
							"sap/ui/thirdparty/jqueryui/jquery-ui-core.js",
							"sap/ui/thirdparty/jqueryui/jquery-ui-position.js",
							"!sap-ui-*.js",
							"!sap/ui/core/support/",
							"!sap/ui/core/plugin/DeclarativeSupport.js",
							"!sap/ui/core/plugin/LessSupport.js",
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
		resources: filteredResources
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


test("generateLibraryPreload for sap.ui.core (/w ui5loader.js)", async (t) => {
	const {
		generateLibraryPreload, moduleBundlerStub, ReaderCollectionPrioritizedStub,
		workspace, dependencies, comboByGlob
	} = t.context;

	const resources = [
		{getPath: sinon.stub().returns("/resources/sap/ui/core/.library")},
		{getPath: sinon.stub().returns("/resources/ui5loader.js")},
		{getPath: sinon.stub().returns("/resources/sap-ui-core.js")}
	];
	const filteredResources = [resources[0], resources[1]]; // without sap-ui-core.js
	comboByGlob.resolves(resources);

	workspace.byGlob.resolves([
		{getPath: sinon.stub().returns("/resources/sap/ui/core/.library")}
	]);

	await generateLibraryPreload({
		workspace,
		dependencies,
		options: {
			projectName: "sap.ui.core"
		}
	});

	t.is(moduleBundlerStub.callCount, 5, "moduleBundler should have been called 5 times");
	t.deepEqual(moduleBundlerStub.getCall(0).args, [{
		options: {
			bundleDefinition: {
				name: "sap-ui-core.js",
				sections: [
					{
						filters: [
							"ui5loader-autoconfig.js"
						],
						mode: "raw",
						resolve: true,
						sort: true,
						declareModules: false
					},
					{
						mode: "preload",
						filters: [
							"sap/ui/core/Core.js"
						],
						resolve: true
					},
					{
						mode: "require",
						filters: [
							"sap/ui/core/Core.js"
						]
					}
				]
			},
			bundleOptions: {
				optimize: true,
				decorateBootstrapModule: true,
				addTryCatchRestartWrapper: true,
				usePredefineCalls: true
			}
		},
		resources: filteredResources
	}]);
	t.deepEqual(moduleBundlerStub.getCall(1).args, [{
		options: {
			bundleDefinition: {
				name: "sap-ui-core-dbg.js",
				sections: [
					{
						filters: [
							"ui5loader-autoconfig.js"
						],
						mode: "raw",
						resolve: true,
						sort: true,
						declareModules: false
					},
					{
						mode: "require",
						filters: [
							"sap/ui/core/Core.js"
						]
					}
				]
			},
			bundleOptions: {
				optimize: false,
				decorateBootstrapModule: false,
				addTryCatchRestartWrapper: false,
				usePredefineCalls: false
			}
		},
		resources: filteredResources
	}]);
	t.deepEqual(moduleBundlerStub.getCall(2).args, [{
		options: {
			bundleDefinition: {
				name: "sap-ui-core-nojQuery.js",
				sections: [
					{
						mode: "provided",
						filters: [
							"jquery-ui-core.js",
							"jquery-ui-datepicker.js",
							"jquery-ui-position.js",
							"sap/ui/thirdparty/jquery.js",
							"sap/ui/thirdparty/jquery/*",
							"sap/ui/thirdparty/jqueryui/*"
						]
					},
					{
						filters: [
							"ui5loader-autoconfig.js"
						],
						mode: "raw",
						resolve: true,
						sort: true,
						declareModules: false
					},
					{
						mode: "preload",
						filters: [
							"sap/ui/core/Core.js"
						],
						resolve: true
					},
					{
						mode: "require",
						filters: [
							"sap/ui/core/Core.js"
						]
					}
				]
			},
			bundleOptions: {
				optimize: true,
				decorateBootstrapModule: true,
				addTryCatchRestartWrapper: true,
				usePredefineCalls: true
			}
		},
		resources: filteredResources
	}]);
	t.deepEqual(moduleBundlerStub.getCall(3).args, [{
		options: {
			bundleDefinition: {
				name: "sap-ui-core-nojQuery-dbg.js",
				sections: [
					{
						mode: "provided",
						filters: [
							"jquery-ui-core.js",
							"jquery-ui-datepicker.js",
							"jquery-ui-position.js",
							"sap/ui/thirdparty/jquery.js",
							"sap/ui/thirdparty/jquery/*",
							"sap/ui/thirdparty/jqueryui/*"
						]
					},
					{
						filters: [
							"ui5loader-autoconfig.js"
						],
						mode: "raw",
						resolve: true,
						sort: true,
						declareModules: false
					},
					{
						mode: "require",
						filters: [
							"sap/ui/core/Core.js"
						]
					}
				]
			},
			bundleOptions: {
				optimize: false,
				decorateBootstrapModule: false,
				addTryCatchRestartWrapper: false,
				usePredefineCalls: false
			}
		},
		resources: filteredResources
	}]);
	t.deepEqual(moduleBundlerStub.getCall(4).args, [{
		options: {
			bundleDefinition: {
				defaultFileTypes: [
					".js",
					".fragment.xml",
					".view.xml",
					".properties",
					".json",
				],
				name: "sap/ui/core/library-preload.js",
				sections: [
					{
						filters: [
							"ui5loader-autoconfig.js",
							"sap/ui/core/Core.js",
						],
						mode: "provided",
						resolve: true,
					},
					{
						filters: [
							"sap/ui/core/",
							"!sap/ui/core/.library",
							"!sap/ui/core/designtime/",
							"!sap/ui/core/**/*.designtime.js",
							"!sap/ui/core/**/*.support.js",
							"!sap/ui/core/themes/",
							"!sap/ui/core/messagebundle*",

							"!sap/ui/core/cldr/",
							"*.js",
							"sap/base/",
							"sap/ui/base/",
							"sap/ui/dom/",
							"sap/ui/events/",
							"sap/ui/model/",
							"sap/ui/security/",
							"sap/ui/util/",
							"sap/ui/Global.js",
							"sap/ui/thirdparty/crossroads.js",
							"sap/ui/thirdparty/caja-htmlsanitizer.js",
							"sap/ui/thirdparty/hasher.js",
							"sap/ui/thirdparty/signals.js",
							"sap/ui/thirdparty/jquery-mobile-custom.js",
							"sap/ui/thirdparty/jqueryui/jquery-ui-core.js",
							"sap/ui/thirdparty/jqueryui/jquery-ui-position.js",
							"!sap-ui-*.js",
							"!sap/ui/core/support/",
							"!sap/ui/core/plugin/DeclarativeSupport.js",
							"!sap/ui/core/plugin/LessSupport.js",
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
		resources: filteredResources
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


test("integration: build library.d with library preload", async (t) => {
	const destPath = "./test/tmp/build/library.d/preload";
	const expectedPath = "./test/expected/build/library.d/preload";
	const excludedTasks = ["*"];
	const includedTasks = ["generateLibraryPreload"];

	return t.notThrowsAsync(builder.build({
		tree: libraryDTree,
		destPath,
		excludedTasks,
		includedTasks
	}).then(() => {
		return findFiles(expectedPath);
	}).then((expectedFiles) => {
		// Check for all directories and files
		assert.directoryDeepEqual(destPath, expectedPath);

		// Check for all file contents
		t.deepEqual(expectedFiles.length, 4, "4 files are expected");
		expectedFiles.forEach((expectedFile) => {
			const relativeFile = path.relative(expectedPath, expectedFile);
			const destFile = path.join(destPath, relativeFile);
			assert.fileEqual(destFile, expectedFile);
		});
	}));
});

const libraryDTree = {
	"id": "library.d",
	"version": "1.0.0",
	"path": libraryDPath,
	"dependencies": [],
	"_level": 1,
	"specVersion": "0.1",
	"type": "library",
	"metadata": {
		"name": "library.d",
		"copyright": "Some fancy copyright"
	},
	"resources": {
		"configuration": {
			"paths": {
				"src": "main/src",
				"test": "main/test"
			}
		},
		"pathMappings": {
			"/resources/": "main/src",
			"/test-resources/": "main/test"
		}
	}
};

test("integration: build library.n with library preload", (t) => {
	const destPath = "./test/tmp/build/library.n/preload";
	const expectedPath = "./test/expected/build/library.n/preload";
	const excludedTasks = ["*"];
	const includedTasks = ["generateLibraryPreload", "generateResourcesJson"];

	return builder.build({
		tree: libraryNTree,
		destPath,
		excludedTasks,
		includedTasks
	}).then(() => {
		return findFiles(expectedPath);
	}).then((expectedFiles) => {
		// Check for all directories and files
		assert.directoryDeepEqual(destPath, expectedPath);

		// Check for all file contents
		return checkFileContentsIgnoreLineFeeds(t, expectedFiles, expectedPath, destPath);
	}).then(() => {
		t.pass();
	});
});

const libraryNTree = {
	"id": "library.n",
	"version": "1.0.0",
	"path": libraryNPath,
	"dependencies": [],
	"_level": 0,
	"specVersion": "0.1",
	"type": "library",
	"metadata": {
		"name": "library.n",
		"namespace": "library/n",
		"copyright": "UI development toolkit for HTML5 (OpenUI5)\n * (c) Copyright 2009-xxx SAP SE or an SAP affiliate company.\n * Licensed under the Apache License, Version 2.0 - see LICENSE.txt."
	},
	"resources": {
		"configuration": {
			"paths": {
				"src": "src",
				"test": "test"
			},
			"propertiesFileSourceEncoding": "ISO-8859-1"
		},
		"pathMappings": {
			"/resources/": "src",
			"/test-resources/": "test"
		}
	}
};


test("integration: build sap.ui.core with library preload", async (t) => {
	const destPath = "./test/tmp/build/sap.ui.core/preload";
	const expectedPath = "./test/expected/build/sap.ui.core/preload";
	const excludedTasks = ["*"];
	const includedTasks = ["generateLibraryPreload"];

	return t.notThrowsAsync(builder.build({
		tree: sapUiCoreTree,
		destPath,
		excludedTasks,
		includedTasks
	}).then(() => {
		return findFiles(expectedPath);
	}).then((expectedFiles) => {
		// Check for all directories and files
		assert.directoryDeepEqual(destPath, expectedPath);

		// Check for all file contents
		t.deepEqual(expectedFiles.length, 9, "9 files are expected");
		expectedFiles.forEach((expectedFile) => {
			const relativeFile = path.relative(expectedPath, expectedFile);
			const destFile = path.join(destPath, relativeFile);
			assert.fileEqual(destFile, expectedFile);
		});
	}));
});

const sapUiCoreTree = {
	"id": "sap.ui.core",
	"version": "1.0.0",
	"path": sapUiCorePath,
	"dependencies": [],
	"_level": 1,
	"specVersion": "0.1",
	"type": "library",
	"metadata": {
		"name": "sap.ui.core",
		"copyright": "Some fancy copyright"
	},
	"resources": {
		"configuration": {
			"paths": {
				"src": "main/src",
				"test": "main/test"
			}
		},
		"pathMappings": {
			"/resources/": "main/src",
			"/test-resources/": "main/test"
		}
	}
};

const newLineRegexp = /\r?\n|\r/g;

async function checkFileContentsIgnoreLineFeeds(t, expectedFiles, expectedPath, destPath) {
	for (let i = 0; i < expectedFiles.length; i++) {
		const expectedFile = expectedFiles[i];
		const relativeFile = path.relative(expectedPath, expectedFile);
		const destFile = path.join(destPath, relativeFile);
		const currentFileContentPromise = readFile(destFile, "utf8");
		const expectedFileContentPromise = readFile(expectedFile, "utf8");
		const assertContents = ([currentContent, expectedContent]) => {
			if (expectedFile.endsWith(".json")) {
				try {
					t.deepEqual(JSON.parse(currentContent), JSON.parse(expectedContent), expectedFile);
				} catch (e) {
					t.falsy(e, expectedFile);
				}
			}
			t.is(currentContent.replace(newLineRegexp, "\n"), expectedContent.replace(newLineRegexp, "\n"), relativeFile);
		};
		await Promise.all([currentFileContentPromise, expectedFileContentPromise]).then(assertContents);
	}
}
