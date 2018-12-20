const {test} = require("ava");
const SmartTemplateAnalyzer = require("../../../../lib/lbt/analyzer/SmartTemplateAnalyzer");


test("Component.js", async (t) => {
	const name = "sap/ui/core/Component.js";
	const subject = new SmartTemplateAnalyzer({});
	const mockInfo = {};
	const oResult = await subject.analyze({name}, mockInfo);
	t.deepEqual(oResult, mockInfo);
});

test("Invalid Manifest returned by pool", async (t) => {
	const mockPool = {async findResource(name) {
		return {
			buffer: async () => Promise.reject("error")
		};
	}};
	const mockInfo = {};
	const subject = new SmartTemplateAnalyzer(mockPool);
	const name = "MyComponent.js";
	const oResult = await subject.analyze({name}, mockInfo);
	t.deepEqual(oResult, mockInfo);
});

test("Manifest", async (t) => {
	t.plan(2);
	const manifest = {
		"sap.ui.generic.app": {
			"pages": [{
				"component": {
					"name": "mycomp.js",
					"settings": {
						"templateName": "myTemplate"
					}
				},
			}]
		}
	};

	const code = "sap.ui.define([\"a\", \"sap/suite/ui/generic/template/lib/TemplateAssembler\"], " +
		"function(a, TemplateAssembler){" +
		"   return TemplateAssembler.getTemplateComponent(getMethods,\n" +
		"		\"sap.suite.ui.generic.templates.Page.Component\", {\n" +
		"			metadata: {\n" +
		"				properties: {\n" +
		"					\"templateName\": {\n" +
		"						\"type\": \"string\",\n" +
		"						\"defaultValue\": \"sap.suite.ui.generic.templates.Page.view.Page\"\n" +
		"					}\n" +
		"				},\n" +
		"				\"manifest\": \"json\"\n" +
		"			}\n" +
		"		});" +
		"});";
	const mockPool = {async findResource(name) {
		return {
			buffer: () => name.endsWith(".json") ? JSON.stringify(manifest): code
		};
	}};

	const dependencies = [];
	const mockInfo = {
		addDependency(name) {
			dependencies.push(name);
		}
	};

	const subject = new SmartTemplateAnalyzer(mockPool);
	const name = "MyComponent.js";
	const oResult = await subject.analyze({name}, mockInfo);
	t.deepEqual(oResult, mockInfo);
	t.deepEqual(dependencies, ["mycomp/js/Component.js", "myTemplate.view.xml"]);
});
