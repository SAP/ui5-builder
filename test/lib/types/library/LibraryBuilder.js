const test = require("ava");
const chai = require("chai");
const path = require("path");
chai.use(require("chai-fs"));

const parentLogger = require("@ui5/logger").getGroupLogger("mygroup");

const LibraryBuilder = require("../../../../lib/types/library/LibraryBuilder");

function clone(o) {
	return JSON.parse(JSON.stringify(o));
}

test("Instantiation", (t) => {
	const project = clone(libraryETree);
	const appBuilder = new LibraryBuilder({parentLogger, project});
	t.truthy(appBuilder);
	t.deepEqual(appBuilder.taskExecutionOrder, [
		"escapeNonAsciiCharacters",
		"replaceCopyright",
		"replaceVersion",
		"generateJsdoc",
		"executeJsdocSdkTransformation",
		"generateLibraryManifest",
		"generateManifestBundle",
		"generateLibraryPreload",
		"buildThemes",
		"createDebugFiles",
		"uglify",
		"generateResourcesJson"
	], "LibraryBuilder is instantiated with standard tasks");
});

const libraryEPath = path.join(__dirname, "..", "..", "..", "fixtures", "library.e");
const libraryETree = {
	id: "library.e.id",
	version: "1.0.0",
	path: libraryEPath,
	dependencies: [],
	_level: 0,
	_isRoot: true,
	specVersion: "2.0",
	type: "library",
	metadata: {
		name: "library.e",
		copyright: "UI development toolkit for HTML5 (OpenUI5)\n * (c) Copyright 2009-xxx SAP SE or an SAP affiliate " +
			"company.\n * Licensed under the Apache License, Version 2.0 - see LICENSE.txt.",
		namespace: "library.e"
	},
	resources: {
		configuration: {
			paths: {
				src: "src",
				test: "test"
			}
		}
	}
};
