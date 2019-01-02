const {test} = require("ava");
const FioriElementsAnalyzer = require("../../../../lib/lbt/analyzer/FioriElementsAnalyzer");
const ModuleInfo = require("../../../../lib/lbt/resources/ModuleInfo");


test("Analysis with an empty pool of resources", async (t) => {
	const emptyPool = {};
	const analyzer = new FioriElementsAnalyzer(emptyPool);
	const name = "sap/ui/core/Component.js";
	const moduleInfo = new ModuleInfo();
	await analyzer.analyze({name}, moduleInfo);
	t.deepEqual(moduleInfo.dependencies, [], "Empty array expected since an empty pool is used");
});

test("Analysis of Manifest and TemplateAssembler code", async (t) => {
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
	const mockPool = {
		async findResource(name) {
			return {
				buffer: () => name.endsWith(".json") ? JSON.stringify(manifest): code
			};
		}
	};

	const moduleInfo = new ModuleInfo();

	const analyzer = new FioriElementsAnalyzer(mockPool);
	const name = "MyComponent.js";
	await analyzer.analyze({name}, moduleInfo);
	t.deepEqual(moduleInfo.dependencies,
		["sap/fe/templates/MyTmpl/Component.js", "sap/fe/templates/Page/view/Page.view.xml"],
		"Resulting dependencies should come from manifest and code");
});
