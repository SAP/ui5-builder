const test = require("ava");

const replaceBuildtime = require("../../../lib/tasks/replaceBuildtime");
const ui5Fs = require("@ui5/fs");
const resourceFactory = ui5Fs.resourceFactory;
const DuplexCollection = ui5Fs.DuplexCollection;

test("integration: replace version", (t) => {
	const reader = resourceFactory.createAdapter({
		virBasePath: "/"
	});
	const writer = resourceFactory.createAdapter({
		virBasePath: "/"
	});

	const content = "// timestamp: ${buildtime}";
	const expectedPrefix = "// timestamp";
	const expectedDatePattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;

	const resource = resourceFactory.createResource({
		path: "/test.js",
		string: content
	});

	const workspace = new DuplexCollection({reader, writer});
	return reader.write(resource).then(() => {
		return replaceBuildtime({
			workspace,
			options: {
				pattern: "/test.js"
			}
		}).then(() => {
			return writer.byPath("/test.js").then((resource) => {
				if (!resource) {
					t.fail("Could not find /test.js in target");
				} else {
					return resource.getBuffer();
				}
			});
		}).then((buffer) => {
			const actualContent = buffer.toString();
			t.not(actualContent, content, "placeholder is overridden");

			const values = actualContent.split(": ");
			t.is(values[0], expectedPrefix, "prefix is unmodified");
			t.true(expectedDatePattern.test(values[1]), "date matches the given pattern");
		});
	});
});
