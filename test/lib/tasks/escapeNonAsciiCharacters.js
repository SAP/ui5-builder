const test = require("ava");

const ui5Builder = require("../../../");
const tasks = ui5Builder.builder.tasks;
const ui5Fs = require("@ui5/fs");
const resourceFactory = ui5Fs.resourceFactory;
const DuplexCollection = ui5Fs.DuplexCollection;

test("integration: escape non ascii characters (utf8, default)", (t) => {
	const reader = resourceFactory.createAdapter({
		virBasePath: "/"
	});
	const writer = resourceFactory.createAdapter({
		virBasePath: "/"
	});
	const workspace = new DuplexCollection({reader, writer});

	const content = `welcome=Willkommen {0}. Bitte geben Sie einen neuen Kontakt ein:
lastname=Nachname:
firstname=Vorname:
street=Straße:♥
zip=PLZ:
city=Ort:`;

	const expected = `welcome=Willkommen {0}. Bitte geben Sie einen neuen Kontakt ein:
lastname=Nachname:
firstname=Vorname:
street=Stra\\u00dfe:\\u2665
zip=PLZ:
city=Ort:`;

	const resource = resourceFactory.createResource({
		path: "/i18n.properties",
		string: content
	});

	return workspace.write(resource).then(() => {
		return tasks.escapeNonAsciiCharacters({
			workspace,
			options: {
				pattern: "/**/*.properties"
			}
		}).then(() => {
			return writer.byPath("/i18n.properties").then((resource) => {
				if (!resource) {
					t.fail("Could not find /i18n.properties in target");
				} else {
					return resource.getString();
				}
			});
		}).then((result) => {
			return t.deepEqual(result, expected);
		});
	});
});

test("integration: escape non ascii characters source encoding being (ISO-8859-1)", (t) => {
	const reader = resourceFactory.createAdapter({
		virBasePath: "/"
	});
	const writer = resourceFactory.createAdapter({
		virBasePath: "/"
	});
	const workspace = new DuplexCollection({reader, writer});

	// create buffer in ISO encoding
	const content = Buffer.from(`welcome=Willkommen {0}. Bitte geben Sie einen neuen Kontakt ein:
lastname=Nachname:
firstname=Vorname:
street=Straße:
zip=PLZ:
city=Ort:`, "latin1");

	const expected = `welcome=Willkommen {0}. Bitte geben Sie einen neuen Kontakt ein:
lastname=Nachname:
firstname=Vorname:
street=Stra\\u00dfe:
zip=PLZ:
city=Ort:`;

	const resource = resourceFactory.createResource({
		path: "/i18n.properties",
		buffer: content
	});

	return workspace.write(resource).then(() => {
		return tasks.escapeNonAsciiCharacters({
			workspace,
			options: {
				encoding: "ISO-8859-1",
				pattern: "/**/*.properties"
			}
		}).then(() => {
			return writer.byPath("/i18n.properties").then((resource) => {
				if (!resource) {
					t.fail("Could not find /i18n.properties in target");
				} else {
					return resource.getString();
				}
			});
		}).then((result) => {
			return t.deepEqual(result, expected);
		});
	});
});

test.skip("integration: escape non ascii characters source encoding being UTF-16", (t) => {
	return tasks.escapeNonAsciiCharacters({
		workspace: undefined,
		options: {
			encoding: "utf16le",
			pattern: "/**/*.properties"
		}
	}).catch((error) => {
		return t.deepEqual(error.message, "Invalid encoding specified: 'UTF-16'. Must be one of UTF-8,ISO-8859-1");
	});
});
