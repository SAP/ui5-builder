import test from "ava";
import path from "node:path";
import {createAdapter, createResource} from "@ui5/fs/resourceFactory";
import DuplexCollection from "@ui5/fs/DuplexCollection";
import {graphFromObject} from "@ui5/project/graph";
import {directoryDeepEqual, fileEqual, findFiles} from "../../../utils/fshelper.js";
import generateLibraryPreload from "../../../../lib/tasks/bundlers/generateLibraryPreload.js";
import * as taskRepository from "../../../../lib/tasks/taskRepository.js";

const __dirname = import.meta.dirname;
const libraryDPath = path.join(__dirname, "..", "..", "..", "fixtures", "library.d");
const libraryDMinifiedPath = path.join(__dirname, "..", "..", "..", "fixtures", "library.d-minified");
const sapUiCorePath = path.join(__dirname, "..", "..", "..", "fixtures", "sap.ui.core");
const libraryNPath = path.join(__dirname, "..", "..", "..", "fixtures", "library.n");

test.serial("integration: build library.d with library preload", async (t) => {
	const destPath = "./test/tmp/build/library.d/preload";
	const expectedPath = "./test/expected/build/library.d/preload";
	const excludedTasks = ["*"];
	const includedTasks = ["generateLibraryPreload"];

	const graph = await graphFromObject({
		dependencyTree: libraryDTree,
	});
	graph.setTaskRepository(taskRepository);
	await t.notThrowsAsync(graph.build({
		destPath,
		excludedTasks,
		includedTasks,
	}));

	const expectedFiles = await findFiles(expectedPath);

	// Check for all directories and files
	await directoryDeepEqual(t, destPath, expectedPath);

	// Check for all file contents
	t.is(expectedFiles.length, 8, "8 files are expected");
	await Promise.all(expectedFiles.map(async (expectedFile) => {
		const relativeFile = path.relative(expectedPath, expectedFile);
		const destFile = path.join(destPath, relativeFile);
		await fileEqual(t, destFile, expectedFile);
	}));
});

const libraryDTree = {
	id: "library.d",
	version: "1.0.0",
	path: libraryDPath,
	dependencies: [],
	configuration: {
		specVersion: "2.0",
		type: "library",
		metadata: {
			name: "library.d",
			copyright: "Some fancy copyright",
		},
		resources: {
			configuration: {
				paths: {
					src: "main/src",
					test: "main/test",
				},
			},
		},
	},
};

test.serial("integration: build library.d-minified with library preload", async (t) => {
	const destPath = "./test/tmp/build/library.d-minified/preload";
	const expectedPath = "./test/expected/build/library.d-minified/preload";
	const excludedTasks = ["*"];
	const includedTasks = ["generateLibraryPreload"];

	const graph = await graphFromObject({
		dependencyTree: libraryDMinifiedTree,
	});
	graph.setTaskRepository(taskRepository);
	await t.notThrowsAsync(graph.build({
		destPath,
		excludedTasks,
		includedTasks,
	}));

	const expectedFiles = await findFiles(expectedPath);

	// Check for all directories and files
	await directoryDeepEqual(t, destPath, expectedPath);

	// Check for all file contents
	t.is(expectedFiles.length, 11, "11 files are expected");
	await Promise.all(expectedFiles.map(async (expectedFile) => {
		const relativeFile = path.relative(expectedPath, expectedFile);
		const destFile = path.join(destPath, relativeFile);
		await fileEqual(t, destFile, expectedFile);
	}));
});

const libraryDMinifiedTree = {
	id: "library.d",
	version: "1.0.0",
	path: libraryDMinifiedPath,
	dependencies: [],
	configuration: {
		specVersion: "2.0",
		type: "library",
		metadata: {
			name: "library.d",
			copyright: "Some fancy copyright",
		},
		resources: {
			configuration: {
				paths: {
					src: "main/src",
					test: "main/test",
				},
			},
		},
	},
};

test.serial("integration: build sap.ui.core with library preload", async (t) => {
	const destPath = "./test/tmp/build/sap.ui.core/preload";
	const expectedPath = "./test/expected/build/sap.ui.core/preload";
	const excludedTasks = ["*"];
	const includedTasks = ["minify", "generateLibraryPreload"];

	const graph = await graphFromObject({
		dependencyTree: sapUiCoreTree,
	});
	graph.setTaskRepository(taskRepository);
	await t.notThrowsAsync(graph.build({
		destPath,
		excludedTasks,
		includedTasks,
	}));

	const expectedFiles = await findFiles(expectedPath);

	// Check for all directories and files
	await directoryDeepEqual(t, destPath, expectedPath);

	// Check for all file contents
	await Promise.all(expectedFiles.map(async (expectedFile) => {
		const relativeFile = path.relative(expectedPath, expectedFile);
		const destFile = path.join(destPath, relativeFile);
		await fileEqual(t, destFile, expectedFile);
	}));
});

const sapUiCoreTree = {
	id: "sap.ui.core",
	version: "1.0.0",
	path: sapUiCorePath,
	dependencies: [],
	configuration: {
		specVersion: "2.0",
		type: "library",
		metadata: {
			name: "sap.ui.core",
			copyright: "Some fancy copyright",
		},
		resources: {
			configuration: {
				paths: {
					src: "main/src",
					test: "main/test",
				},
			},
		},
	},
};

test.serial("integration: generateLibraryPreload", async (t) => {
	const reader = createAdapter({
		virBasePath: "/",
	});
	await reader.write(createResource({
		path: "/resources/my/test/lib/library.js",
		string: "",
	}));

	const writer = createAdapter({
		virBasePath: "/",
	});
	const duplexCollection = new DuplexCollection({reader, writer});
	const dependencies = createAdapter({
		virBasePath: "/",
	});

	await generateLibraryPreload({
		workspace: duplexCollection,
		dependencies: dependencies,
		options: {
			projectName: "my.test.lib",
		},
	});

	const writtenResources = await writer.byGlob(["**/**"]);
	t.deepEqual(writtenResources.map((r) => r.getPath()).sort(), [
		"/resources/my/test/lib/library-preload.js",
		"/resources/my/test/lib/library-preload.js.map",
	], "Expected preload files should be created");

	const libraryPreload = await writer.byPath("/resources/my/test/lib/library-preload.js");
	t.truthy(libraryPreload, "library-preload.js should have been created");
	const libraryPreloadContent = await libraryPreload.getString();
	t.true(libraryPreloadContent.includes("//@ui5-bundle my/test/lib/library-preload.js"),
		"library-preload should be a bundle");
	t.regex(libraryPreloadContent, new RegExp("my/test/lib/library"),
		"library-preload should include library.js module");

	const libraryPreloadSourceMap = await writer.byPath("/resources/my/test/lib/library-preload.js.map");
	const libraryPreloadSourceMapContent = await libraryPreloadSourceMap.getString();
	t.notThrows(() => {
		JSON.parse(libraryPreloadSourceMapContent);
	}, "Source map file should have valid JSON content");
});

test.serial("integration: generateLibraryPreload with designtime and support files", async (t) => {
	const reader = createAdapter({
		virBasePath: "/",
	});
	await reader.write(createResource({
		path: "/resources/my/test/lib/library.js",
		string: "",
	}));

	// designtime
	await reader.write(createResource({
		path: "/resources/my/test/lib/designtime/foo.js",
		string: "",
	}));
	await reader.write(createResource({
		path: "/resources/my/test/lib/some.designtime.js",
		string: "",
	}));

	// support
	await reader.write(createResource({
		path: "/resources/my/test/lib/some.support.js",
		string: "",
	}));
	await reader.write(createResource({
		path: "/resources/my/test/lib/support/foo.support.js",
		string: "",
	}));

	const writer = createAdapter({
		virBasePath: "/",
	});
	const duplexCollection = new DuplexCollection({reader, writer});
	const dependencies = createAdapter({
		virBasePath: "/",
	});

	await generateLibraryPreload({
		workspace: duplexCollection,
		dependencies: dependencies,
		options: {
			projectName: "my.test.lib",
		},
	});

	const writtenResources = await writer.byGlob(["**/**"]);
	t.deepEqual(writtenResources.map((r) => r.getPath()).sort(), [
		"/resources/my/test/lib/designtime/library-preload.designtime.js",
		"/resources/my/test/lib/designtime/library-preload.designtime.js.map",
		"/resources/my/test/lib/library-preload.js",
		"/resources/my/test/lib/library-preload.js.map",
		"/resources/my/test/lib/library-preload.support.js",
		"/resources/my/test/lib/library-preload.support.js.map",
	], "Expected preload files should be created");

	const libraryPreload = await writer.byPath("/resources/my/test/lib/library-preload.js");
	t.truthy(libraryPreload, "library-preload.js should have been created");
	const libraryPreloadContent = await libraryPreload.getString();
	t.true(libraryPreloadContent.includes("//@ui5-bundle my/test/lib/library-preload.js"),
		"library-preload should be a bundle");
	t.regex(libraryPreloadContent, new RegExp("my/test/lib/library"),
		"library-preload should include library.js module");

	const designtimePreload = await writer.byPath("/resources/my/test/lib/designtime/library-preload.designtime.js");
	t.truthy(designtimePreload, "library-preload.js should have been created");
	const designtimePreloadContent = await designtimePreload.getString();
	t.true(designtimePreloadContent.includes("//@ui5-bundle my/test/lib/designtime/library-preload.designtime.js"),
		"library-preload.designtime should be a bundle");
	t.regex(designtimePreloadContent, new RegExp("my/test/lib/designtime/foo"),
		"library-preload should include designtime/foo module");
	t.regex(designtimePreloadContent, new RegExp("my/test/lib/some\\.designtime"),
		"library-preload should include some.designtime module");

	const supportPreload = await writer.byPath("/resources/my/test/lib/library-preload.support.js");
	t.truthy(supportPreload, "library-preload.js should have been created");
	const supportPreloadContent = await supportPreload.getString();
	t.true(supportPreloadContent.includes("//@ui5-bundle my/test/lib/library-preload.support.js"),
		"library-preload.support should be a bundle");
	t.regex(supportPreloadContent, new RegExp("my/test/lib/some\\.support"),
		"library-preload.support should include some.support module");
	t.regex(supportPreloadContent, new RegExp("my/test/lib/support/foo\\.support"),
		"library-preload.support should include support/foo.support module");

	const libraryPreloadSourceMap = await writer.byPath("/resources/my/test/lib/library-preload.js.map");
	const libraryPreloadSourceMapContent = await libraryPreloadSourceMap.getString();
	t.notThrows(() => {
		JSON.parse(libraryPreloadSourceMapContent);
	}, "Source map file should have valid JSON content");

	const designtimePreloadSourceMap =
		await writer.byPath("/resources/my/test/lib/designtime/library-preload.designtime.js.map");
	const designtimePreloadSourceMapContent = await designtimePreloadSourceMap.getString();
	t.notThrows(() => {
		JSON.parse(designtimePreloadSourceMapContent);
	}, "Source map file should have valid JSON content");

	const supportPreloadSourceMap =
		await writer.byPath("/resources/my/test/lib/library-preload.support.js.map");
	const supportPreloadSourceMapContent = await supportPreloadSourceMap.getString();
	t.notThrows(() => {
		JSON.parse(supportPreloadSourceMapContent);
	}, "Source map file should have valid JSON content");
});

test.serial("integration: build library.n without enabled string bundling", async (t) => {
	const destPath = "./test/tmp/build/library.n/dest";
	const expectedPath = "./test/expected/build/library.n/dest";
	const excludedTasks = ["*"];
	const includedTasks = ["generateLibraryPreload"];

	const graph = await graphFromObject({
		dependencyTree: libraryNTree,
	});
	graph.setTaskRepository(taskRepository);
	await t.notThrowsAsync(graph.build({
		destPath,
		excludedTasks,
		includedTasks,
	}));

	const expectedFiles = await findFiles(expectedPath);

	// Check for all directories and files
	await directoryDeepEqual(t, destPath, expectedPath);

	// Check for all file contents
	t.is(expectedFiles.length, 6, "6 files are expected");
	await Promise.all(expectedFiles.map(async (expectedFile) => {
		const relativeFile = path.relative(expectedPath, expectedFile);
		const destFile = path.join(destPath, relativeFile);
		await fileEqual(t, destFile, expectedFile);
	}));
});

const libraryNTree = {
	id: "library.n",
	version: "1.0.0",
	path: libraryNPath,
	dependencies: [],
	configuration: {
		specVersion: "4.0",
		type: "library",
		metadata: {
			name: "library.n",
			copyright: "Some fancy copyright",
		},
	},
};

test.serial("integration: build library.n with enabled string bundling", async (t) => {
	const destPath = "./test/tmp/build/library.n/legacy";
	const expectedPath = "./test/expected/build/library.n/legacy";
	const excludedTasks = ["*"];
	const includedTasks = ["generateLibraryPreload"];

	const graph = await graphFromObject({
		dependencyTree: libraryNTreeLegacy,
	});
	graph.setTaskRepository(taskRepository);
	await t.notThrowsAsync(graph.build({
		destPath,
		excludedTasks,
		includedTasks,
	}));

	const expectedFiles = await findFiles(expectedPath);

	// Check for all directories and files
	await directoryDeepEqual(t, destPath, expectedPath);

	// Check for all file contents
	t.is(expectedFiles.length, 6, "6 files are expected");
	await Promise.all(expectedFiles.map(async (expectedFile) => {
		const relativeFile = path.relative(expectedPath, expectedFile);
		const destFile = path.join(destPath, relativeFile);
		await fileEqual(t, destFile, expectedFile);
	}));
});

const libraryNTreeLegacy = {
	id: "library.n",
	version: "1.0.0",
	path: libraryNPath,
	dependencies: [],
	configuration: {
		specVersion: "3.1",
		type: "library",
		metadata: {
			name: "library.n",
			copyright: "Some fancy copyright",
		},
	},
};
