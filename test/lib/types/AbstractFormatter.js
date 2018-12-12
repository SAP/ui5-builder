const {test} = require("ava");
const path = require("path");
const chai = require("chai");
chai.use(require("chai-fs"));
const assert = chai.assert;

const AbstractFormatter = require("../../../lib/types/AbstractFormatter");

class CustomFormatter extends AbstractFormatter {

}

test("Abstract Formatter non existing dir", (t) => {
	const nonExistingFile = path.resolve("non-existing");
	assert.notPathExists(nonExistingFile, "path should not exist");
	return new CustomFormatter().dirExists(nonExistingFile).then((bExists) => {
		t.false(bExists);
	});
});

test("Abstract Formatter existing dir", (t) => {
	const parentDirectory = path.resolve("..");
	assert.isDirectory(parentDirectory, "path is a directory");
	return new CustomFormatter().dirExists(parentDirectory).then((bExists) => {
		t.true(bExists);
	});
});

test("Abstract Formatter existing file", (t) => {
	const file = path.resolve(__filename);
	assert.notIsDirectory(file, "path is not a directory");
	return new CustomFormatter().dirExists(file).then((bExists) => {
		t.false(bExists);
	});
});
