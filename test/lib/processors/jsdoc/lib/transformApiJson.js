import test from "ava";
import esmock from "esmock";
import sinonGlobal from "sinon";

test.beforeEach(async (t) => {
	t.context.sinon = sinonGlobal.createSandbox();
	t.context.transformApiJson = await esmock("../../../../../lib/processors/jsdoc/lib/transformApiJson.cjs");
});

test.afterEach.always((t) => {
	t.context.sinon.restore();
});

test("Basic test without symbols", async (t) => {
	const {sinon, transformApiJson} = t.context;

	const apiJsonPath = "/test-resources/sap/ui5/tooling/test/designtime/api.json";
	const fakeTargetPath = "/ignore/this/path/resource/will/be/returned";
	const dotLibraryPath = "/resources/sap/ui5/tooling/test/.library";
	const dependencyApiJsonPaths = [
		"/resources/some/path/x/api.json",
		"/resources/some/path/y/api.json"
	];

	const fs = {
		readFile: sinon.stub().yieldsAsync(new Error("Not found!"))
			.withArgs("/some/path/.library").yieldsAsync(null, `
			<?xml version="1.0" encoding="UTF-8" ?>
			<library xmlns="http://www.sap.com/sap.ui.library.xsd" >

				<name>sap.ui5.tooling.test</name>
				<vendor>SAP SE</vendor>
				<copyright>Some copyright notice</copyright>
				<version>1.2.3</version>

				<documentation>UI5 Tooling Test Library</documentation>

			</library>`)
			.withArgs("/test-resources/sap/ui5/tooling/test/designtime/api.json").yieldsAsync(null, JSON.stringify(
				{
					"$schema-ref": "http://schemas.sap.com/sapui5/designtime/api.json/1.0",
					"version": "1.2.3",
					"library": "sap.ui5.tooling.test",
					"symbols": []
				}
			)),

		readdir: sinon.stub().yieldsAsync(new Error("Not found!"))
	};

	const apiJsonContent = await transformApiJson(
		apiJsonPath, fakeTargetPath, dotLibraryPath, dependencyApiJsonPaths, "", {
			fs,
			returnOutputFiles: true
		}
	);

	t.is(apiJsonContent, JSON.stringify({
		"$schema-ref": "http://schemas.sap.com/sapui5/designtime/api.json/1.0",
		"version": "1.2.3",
		"library": "sap.ui5.tooling.test",
		"symbols": []
	}));
});
