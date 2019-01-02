const {test} = require("ava");
const SmartTemplateAnalyzer = require("../../../../lib/lbt/analyzer/SmartTemplateAnalyzer");
const ModuleInfo = require("../../../../lib/lbt/resources/ModuleInfo");


test("Analysis with an empty pool of resources", async (t) => {
	const emptyPool = {};
	const analyzer = new SmartTemplateAnalyzer(emptyPool);
	const name = "sap/ui/core/Component.js";
	const moduleInfo = new ModuleInfo();
	await analyzer.analyze({name}, moduleInfo);
	t.deepEqual(moduleInfo.dependencies, [], "Empty array expected since an empty pool is used");
});

test("Invalid Manifest returned by pool", async (t) => {
	const mockPool = {
		async findResource() {
			return {
				buffer: async () => Promise.reject("error")
			};
		}
	};
	const subject = new SmartTemplateAnalyzer(mockPool);
	const name = "MyComponent.js";
	const moduleInfo = new ModuleInfo();
	await subject.analyze({name}, moduleInfo);
	t.deepEqual(moduleInfo.dependencies, [], "Empty array since pool fails finding the resources");
});

test("Analysis of Manifest and TemplateAssembler code", async (t) => {
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

	const code = `sap.ui.define(["a", "sap/suite/ui/generic/template/lib/TemplateAssembler"], 
		function(a, TemplateAssembler){   return TemplateAssembler.getTemplateComponent(getMethods,
		"sap.suite.ui.generic.templates.Page.Component", {
			metadata: {
				properties: {
					"templateName": {
						"type": "string",
						"defaultValue": "sap.suite.ui.generic.templates.Page.view.Page"
					}
				},
				"manifest": "json"
			}
		});
	});`;
	const mockPool = {
		async findResource(name) {
			return {
				buffer: () => name.endsWith(".json") ? JSON.stringify(manifest): code
			};
		}
	};

	const moduleInfo = new ModuleInfo();

	const analyzer = new SmartTemplateAnalyzer(mockPool);
	const name = "MyComponent.js";
	await analyzer.analyze({name}, moduleInfo);
	t.deepEqual(moduleInfo.dependencies, ["mycomp/js/Component.js", "myTemplate.view.xml"],
		"Resulting dependencies should come from manifest and code");
});
