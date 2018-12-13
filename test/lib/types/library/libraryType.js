const {test} = require("ava");
const chai = require("chai");
chai.use(require("chai-fs"));

const libraryType = require("../../../../lib/types/library/libraryType");

test("libraryType#format: Project is undefined", async (t) => {
	return libraryType.format(null).catch((error) => {
		t.is(error.message, "Project is undefined");
		t.pass();
	});
});
