const {test} = require("ava");

const ui5Builder = require("../../../");
const tasks = ui5Builder.builder.tasks;
const ui5Fs = require("@ui5/fs");
const resourceFactory = ui5Fs.resourceFactory;
const DuplexCollection = ui5Fs.DuplexCollection;

test("integration: babel", (t) => {
	const reader = resourceFactory.createAdapter({
		virBasePath: "/"
	});
	const writer = resourceFactory.createAdapter({
		virBasePath: "/"
	});
	const duplexCollection = new DuplexCollection({reader: reader, writer: writer});
	const content = `
function test(paramA) {
	console.log(...paramA);
}
test();`;
	const testResource = resourceFactory.createResource({
		path: "/test.js",
		string: content
	});
	const expected = "_toConsumableArray";

	return reader.write(testResource)
		.then(() => {
			return reader.byPath("/test.js");
		}).then(() => {
			return tasks.transformBabel({
				workspace: duplexCollection,
				options: {
					pattern: "/test.js"
				}
			});
		}).then(() => {
			return writer.byPath("/test.js").then((resource) => {
				if (!resource) {
					t.fail("Could not find /test.js in target locator");
				} else {
					return resource.getBuffer();
				}
			});
		}).then((buffer) => {
			return t.true(buffer.toString().indexOf(expected) > 0);
		});
});
