const {test} = require("ava");
const path = require("path");
const chai = require("chai");
chai.use(require("chai-fs"));
const assert = chai.assert;

const AbstractFormatter = require("../../../lib/types/AbstractFormatter");

class CustomFormatter extends AbstractFormatter {
}

test("non existing dir", (t) => {
	t.plan(1);
	const nonExistingFile = path.resolve("non-existing");
	assert.notPathExists(nonExistingFile, "path should not exist");
	return new CustomFormatter().dirExists(nonExistingFile).then((bExists) => {
		t.false(bExists, "non-existing does not exist");
	});
});

test("existing dir", (t) => {
	t.plan(1);
	const parentDirectory = path.resolve(__dirname);
	assert.isDirectory(parentDirectory, "path is a directory");
	return new CustomFormatter().dirExists(parentDirectory).then((bExists) => {
		t.true(bExists, "directory __dirname always exists");
	});
});

test("existing file", (t) => {
	t.plan(1);
	const file = path.resolve(__filename);
	assert.notIsDirectory(file, "path is not a directory");
	return new CustomFormatter().dirExists(file).then((bExists) => {
		t.false(bExists, "file __filename exists but ");
	});
});
