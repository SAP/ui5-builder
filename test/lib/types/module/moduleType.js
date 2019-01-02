const {test} = require("ava");
const chai = require("chai");
chai.use(require("chai-fs"));

const moduleType = require("../../../../lib/types/module/moduleType");

const groupLogger = require("@ui5/logger").getGroupLogger("mygroup2");

test("format without project", async (t) => {
	return moduleType.format(null).catch((error) => {
		t.is(error.message, "Project is undefined");
		t.pass();
	});
});

test("build without project", async (t) => {
	const oProject = {
		metadata: {
			name: "myproject"
		}
	};
	return moduleType.build({parentLogger: groupLogger, project: oProject, tasks: []}).then((oResult) => {
		t.falsy(oResult, "result is not there");
		t.pass();
	});
});
