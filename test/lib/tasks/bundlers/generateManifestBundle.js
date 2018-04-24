const {test} = require("ava");
const path = require("path");
const chai = require("chai");
chai.use(require("chai-fs"));
const assert = chai.assert;


const ui5Builder = require("../../../../");
const builder = ui5Builder.builder;
const applicationBPath = path.join(__dirname, "..", "..", "..", "fixtures", "application.b");
const Zip = require("adm-zip");

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

test("Build application.b with manifestBundler", (t) => {
	const destPath = path.join(__dirname, "..", "..", "..", "tmp", "build", "application.b", "dest");
	const destBundle = path.join(destPath, "manifest-bundle");
	const expectedPath = path.join(__dirname, "..", "..", "..", "expected", "build", "application.b", "dest");
	const excludedTasks = ["*"];
	const includedTasks = ["generateManifestBundle"];

	return builder.build({
		tree: applicationBTree,
		destPath,
		excludedTasks,
		includedTasks
	}).then(() => {
		return findFiles(expectedPath);
	}).then((expectedFiles) => {
		const zip = new Zip(destBundle + ".zip");
		zip.extractAllTo(destBundle, true);
		// Check for all directories and files
		assert.directoryDeepEqual(destBundle, expectedPath);

		// Check for all file contents
		expectedFiles.forEach((expectedFile) => {
			const relativeFile = path.relative(expectedPath, expectedFile);
			const destFile = path.join(destBundle, relativeFile);
			assert.fileEqual(destFile, expectedFile);
			t.pass();
		});
	});
});

const applicationBTree = {
	"id": "application.b",
	"version": "1.0.0",
	"path": applicationBPath,
	"dependencies": [],
	"_level": 0,
	"specVersion": "0.1",
	"type": "application",
	"metadata": {
		"name": "application.b",
		"namespace": "id1"
	},
	"resources": {
		"configuration": {
			"paths": {
				"webapp": "webapp"
			}
		},
		"pathMappings": {
			"/": "webapp"
		}
	}
};
