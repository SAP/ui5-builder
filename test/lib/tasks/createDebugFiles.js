const {test} = require("ava");

const ui5Builder = require("../../../");
const tasks = ui5Builder.builder.tasks;
const ui5Fs = require("@ui5/fs");
const resourceFactory = ui5Fs.resourceFactory;

test("test.js: dbg file creation", (t) => {
	const sourceAdapter = resourceFactory.createAdapter({
		virBasePath: "/"
	});
	const content = "console.log('Hello World');";

	const resource = resourceFactory.createResource({
		path: "/test.js",
		string: content
	});

	return sourceAdapter.write(resource).then(() => {
		return tasks.createDebugFiles({
			workspace: sourceAdapter,
			options: {
				pattern: "/**/*.js"
			}
		}).then(() => {
			return sourceAdapter.byPath("/test-dbg.js").then((resource) => {
				if (!resource) {
					t.fail("Could not find /test-dbg.js in target");
				} else {
					return resource.getBuffer();
				}
			});
		}).then((buffer) => {
			t.deepEqual(buffer.toString(), content, "Correct content");
		});
	});
});

test("test.view.js: dbg file creation", (t) => {
	const sourceAdapter = resourceFactory.createAdapter({
		virBasePath: "/"
	});
	const content = "console.log('Hello World');";

	const resource = resourceFactory.createResource({
		path: "/test.view.js",
		string: content
	});

	return sourceAdapter.write(resource).then(() => {
		return tasks.createDebugFiles({
			workspace: sourceAdapter,
			options: {
				pattern: "/**/*.js"
			}
		}).then(() => {
			return sourceAdapter.byPath("/test-dbg.view.js").then((resource) => {
				if (!resource) {
					t.fail("Could not find /test-dbg.view.js in target");
				} else {
					return resource.getBuffer();
				}
			});
		}).then((buffer) => {
			t.deepEqual(buffer.toString(), content, "Correct content");
		});
	});
});

test("test.controller.js: dbg file creation", (t) => {
	const sourceAdapter = resourceFactory.createAdapter({
		virBasePath: "/"
	});
	const content = "console.log('Hello World');";

	const resource = resourceFactory.createResource({
		path: "/test.controller.js",
		string: content
	});

	return sourceAdapter.write(resource).then(() => {
		return tasks.createDebugFiles({
			workspace: sourceAdapter,
			options: {
				pattern: "/**/*.js"
			}
		}).then(() => {
			return sourceAdapter.byPath("/test-dbg.controller.js").then((resource) => {
				if (!resource) {
					t.fail("Could not find /test-dbg.controller.js in target");
				} else {
					return resource.getBuffer();
				}
			});
		}).then((buffer) => {
			t.deepEqual(buffer.toString(), content, "Correct content");
		});
	});
});

test("test.fragment.js: dbg file creation", (t) => {
	const sourceAdapter = resourceFactory.createAdapter({
		virBasePath: "/"
	});
	const content = "console.log('Hello World');";

	const resource = resourceFactory.createResource({
		path: "/test.fragment.js",
		string: content
	});

	return sourceAdapter.write(resource).then(() => {
		return tasks.createDebugFiles({
			workspace: sourceAdapter,
			options: {
				pattern: "/**/*.js"
			}
		}).then(() => {
			return sourceAdapter.byPath("/test-dbg.fragment.js").then((resource) => {
				if (!resource) {
					t.fail("Could not find /test-dbg.fragment.js in target locator");
				} else {
					return resource.getBuffer();
				}
			});
		}).then((buffer) => {
			t.deepEqual(buffer.toString(), content, "Correct content");
		});
	});
});

test("test-dbg.js: dbg-dbg file creation", (t) => {
	const sourceAdapter = resourceFactory.createAdapter({
		virBasePath: "/"
	});
	const content = "console.log('Hello World');";

	const resource = resourceFactory.createResource({
		path: "/test-dbg.js",
		string: content
	});

	return sourceAdapter.write(resource).then(() => {
		return tasks.createDebugFiles({
			workspace: sourceAdapter,
			options: {
				pattern: "/**/*.js"
			}
		}).then(() => {
			return sourceAdapter.byPath("/test-dbg-dbg.js").then((resource) => {
				if (!resource) {
					t.fail("Could not find /test-dbg-dbg.js in target locator");
				} else {
					return resource.getBuffer();
				}
			});
		}).then((buffer) => {
			t.deepEqual(buffer.toString(), content, "Correct content");
		});
	});
});

test("test.xml: *no* dbg file creation", (t) => {
	const sourceAdapter = resourceFactory.createAdapter({
		virBasePath: "/"
	});
	const content = "<xml></xml>";

	const resource = resourceFactory.createResource({
		path: "/test.xml",
		string: content
	});

	return sourceAdapter.write(resource).then(() => {
		return tasks.createDebugFiles({
			workspace: sourceAdapter,
			options: {
				pattern: "/**/*.js"
			}
		}).then(() => {
			return sourceAdapter.byPath("/test-dbg.xml").then((resource) => {
				if (!resource) {
					t.pass("Could not find /test-dbg.xml in target locator as it is not a JavaScript file");
				} else {
					t.fail("Found /test-dbg.xml which should not be there (no JavaScript file)");
				}
			});
		});
	});
});

test("test1.js, test2.js: dbg file creation", (t) => {
	const sourceAdapter = resourceFactory.createAdapter({
		virBasePath: "/"
	});
	const content = "console.log('Hello World');";

	const resources = [
		resourceFactory.createResource({
			path: "/test1.js",
			string: content
		}),
		resourceFactory.createResource({
			path: "/test2.js",
			string: content
		})
	];

	return Promise.all(resources.map((resource) => {
		return sourceAdapter.write(resource);
	})).then(() => {
		return tasks.createDebugFiles({
			workspace: sourceAdapter,
			options: {
				pattern: "/**/*.js"
			}
		}).then(() => {
			return Promise.all([
				sourceAdapter.byPath("/test1-dbg.js"),
				sourceAdapter.byPath("/test2-dbg.js")
			]).then((resources) => {
				if (!resources || !resources[0] || !resources[1]) {
					t.fail("Could not find /test1-dbg.js and/or /test2-dbg.js in target locator");
				} else {
					return Promise.all(resources.map((resource) => {
						return resource.getBuffer();
					}));
				}
			});
		}).then((buffers) => {
			t.deepEqual(buffers[0].toString(), content, "Content of /test1-dbg.js is correct");
			t.deepEqual(buffers[1].toString(), content, "Content of /test2-dbg.js is correct");
		});
	});
});
