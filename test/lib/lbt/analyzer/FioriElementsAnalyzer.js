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

	const code = `sap.ui.define(["a", "sap/fe/core/TemplateAssembler"], function(a, TemplateAssembler){   
		return TemplateAssembler.getTemplateComponent(getMethods,
		"sap.fe.templates.Page.Component", {
			metadata: {
				properties: {
					"templateName": {
						"type": "string",
						"defaultValue": "sap.fe.templates.Page.view.Page"
					}
				},
				"manifest": "json"
			}
		});});`;
	const mockPool = {async findResource(name) {
		return {
			buffer: () => name.endsWith(".json") ? JSON.stringify(manifest): code
		};
	}};

	const aDependencies = [];
	const mockInfo = {
		addDependency(name) {
			aDependencies.push(name);
		}
	};

	const subject = new FioriElementsAnalyzer(mockPool);
	const name = "MyComponent.js";
	await subject.analyze({name}, mockInfo);
	t.deepEqual(aDependencies, ["sap/fe/templates/MyTmpl/Component.js", "sap/fe/templates/Page/view/Page.view.xml"]);
});
