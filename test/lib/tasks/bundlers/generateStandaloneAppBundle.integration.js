import test from "ava";
import {fileURLToPath} from "node:url";
import path from "node:path";
import chai from "chai";
import chaiFs from "chai-fs";
chai.use(chaiFs);
const assert = chai.assert;
import sinon from "sinon";
import {graphFromObject} from "@ui5/project/graph";
import * as taskRepository from "../../../../lib/tasks/taskRepository.js";
import recursive from "recursive-readdir";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const applicationBPath = path.join(__dirname, "..", "..", "..", "fixtures", "application.b");
const sapUiCorePath = path.join(__dirname, "..", "..", "..", "fixtures", "sap.ui.core");

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

test.afterEach.always((t) => {
	sinon.restore();
});

test("integration: build application.b standalone", async (t) => {
	const destPath = "./test/tmp/build/application.b/standalone";
	const expectedPath = "./test/expected/build/application.b/standalone";
	const excludedTasks = ["*"];
	const includedTasks = ["minify", "generateStandaloneAppBundle"];

	const graph = await graphFromObject({
		dependencyTree: applicationBTree
	});

	graph.setTaskRepository(taskRepository);
	await graph.build({
		destPath,
		excludedTasks,
		includedTasks
	});
	const expectedFiles = await findFiles(expectedPath);

	// Check for all directories and files
	assert.directoryDeepEqual(destPath, expectedPath, "Result directory structure correct");

	// Check for all file contents
	expectedFiles.forEach((expectedFile) => {
		const relativeFile = path.relative(expectedPath, expectedFile);
		const destFile = path.join(destPath, relativeFile);
		assert.fileEqual(destFile, expectedFile, "Correct file content");
	});
	t.pass("No assertion exception");
});

const applicationBTree = {
	"id": "application.b",
	"version": "1.0.0",
	"path": applicationBPath,
	"dependencies": [
		{
			"id": "sap.ui.core",
			"version": "1.0.0",
			"path": sapUiCorePath,
			"dependencies": [],
			"configuration": {
				"specVersion": "2.0",
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
					}
				}
			},
		},
		{
			"id": "library.d",
			"version": "1.0.0",
			"path": path.join(applicationBPath, "..", "library.d"),
			"dependencies": [],
			"configuration": {
				"specVersion": "2.0",
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
					}
				}
			},
		},
		{
			"id": "library.a",
			"version": "1.0.0",
			"path": path.join(applicationBPath, "..", "collection", "library.a"),
			"dependencies": [],
			"configuration": {
				"specVersion": "2.0",
				"type": "library",
				"metadata": {
					"name": "library.a",
					"copyright": "${copyright}"
				},
				"resources": {
					"configuration": {
						"paths": {
							"src": "src",
							"test": "test"
						}
					}
				}
			},
		},
		{
			"id": "library.b",
			"version": "1.0.0",
			"path": path.join(applicationBPath, "..", "collection", "library.b"),
			"dependencies": [],
			"configuration": {
				"specVersion": "2.0",
				"type": "library",
				"metadata": {
					"name": "library.b",
					"copyright": "${copyright}"
				},
				"resources": {
					"configuration": {
						"paths": {
							"src": "src",
							"test": "test"
						}
					}
				}
			}
		},
		{
			"id": "library.c",
			"version": "1.0.0",
			"path": path.join(applicationBPath, "..", "collection", "library.c"),
			"dependencies": [],
			"configuration": {
				"specVersion": "2.0",
				"type": "library",
				"metadata": {
					"name": "library.c",
					"copyright": "${copyright}"
				},
				"resources": {
					"configuration": {
						"paths": {
							"src": "src",
							"test": "test"
						}
					}
				}
			},
		}
	],
	"configuration": {
		"builder": {},
		"specVersion": "2.0",
		"type": "application",
		"metadata": {
			"name": "application.b"
		},
		"resources": {
			"configuration": {
				"paths": {
					"webapp": "webapp"
				},
				"propertiesFileSourceEncoding": "ISO-8859-1"
			}
		}
	},
};
