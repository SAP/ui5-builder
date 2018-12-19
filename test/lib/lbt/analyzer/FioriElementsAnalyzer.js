const {test} = require("ava");
const FioriElementsAnalyzer = require("../../../../lib/lbt/analyzer/FioriElementsAnalyzer");


test("Component.js", async (t) => {
	const name = "sap/ui/core/Component.js";
	const subject = new FioriElementsAnalyzer({});
	const mockInfo = {};
	const oResult = await subject.analyze({name}, mockInfo);
	t.deepEqual(oResult, mockInfo);
});

test("Manifest", async (t) => {
	t.plan(3);
	const manifest = {
		"sap.fe": {
			"entitySets": [{
				"mySet": {
					"myProp": {
						"template": "MyTmpl"
					}
				}
			}]
		}
	};

	const code = "sap.ui.define([\"a\", \"sap/fe/core/TemplateAssembler\"], " +
		"function(a, TemplateAssembler){" +
		"   return TemplateAssembler.getTemplateComponent(getMethods,\n" +
		"		\"sap.fe.templates.Page.Component\", {\n" +
		"			metadata: {\n" +
		"				properties: {\n" +
		"					\"templateName\": {\n" +
		"						\"type\": \"string\",\n" +
		"						\"defaultValue\": \"sap.fe.templates.Page.view.Page\"\n" +
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

	let iCounter = 0;
	const mockInfo = {
		addDependency(name) {
			if (iCounter++ === 0) {
				t.is(name, "sap/fe/templates/MyTmpl/Component.js");
			} else {
				t.is(name, "sap/fe/templates/Page/view/Page.view.xml");
			}
		}
	};

	const subject = new FioriElementsAnalyzer(mockPool);
	const name = "MyComponent.js";
	const oResult = await subject.analyze({name}, mockInfo);
	t.deepEqual(oResult, mockInfo);
});
