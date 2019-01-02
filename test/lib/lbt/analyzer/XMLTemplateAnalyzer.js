const {test} = require("ava");
const XMLTemplateAnalyzer = require("../../../../lib/lbt/analyzer/XMLTemplateAnalyzer");
const ModuleInfo = require("../../../../lib/lbt/resources/ModuleInfo");

test("Analysis of an xml view", async (t) => {
	const xml = `<mvc:View xmlns:mvc="sap.ui.core.mvc" xmlns:m="sap.m" xmlns:l="sap.ui.layout" 
		controllerName="myController">
			<l:HorizontalLayout id="layout">
				<m:Button text="Button 1" id="button1" />
				<m:Button text="Button 2" id="button2" />
				<m:Button text="Button 3" id="button3" />
			</l:HorizontalLayout>
		</mvc:View>`;
	const mockPool = {async findResource(name) {
		return {
			buffer: () => name.endsWith(".xml") ? JSON.stringify(xml): "test"
		};
	}};

	const moduleInfo = new ModuleInfo();

	const analyzer = new XMLTemplateAnalyzer(mockPool);
	await analyzer.analyzeView(xml, moduleInfo);
	t.deepEqual(moduleInfo.dependencies,
		[
			"sap/ui/core/mvc/XMLView.js",
			"myController.controller.js",
			"sap/ui/layout/HorizontalLayout.js",
			"sap/m/Button.js"
		], "Dependencies should come from the XML template");
	t.true(moduleInfo.isImplicitDependency("sap/ui/core/mvc/XMLView.js"),
		"Implicit dependency should be added since an XMLView is analyzed");
});

test("Analysis of an xml fragment", async (t) => {
	const xml = `<HBox xmlns:m="sap.m" xmlns:l="sap.ui.layout" controllerName="myController">
			<items>
				<l:HorizontalLayout id="layout">
					<m:Button text="Button 1" id="button1" />
					<m:Button text="Button 2" id="button2" />
					<m:Button text="Button 3" id="button3" />
				</l:HorizontalLayout>
			</items>
		</HBox>`;
	const mockPool = {async findResource(name) {
		return {
			buffer: () => name.endsWith(".xml") ? JSON.stringify(xml): "test"
		};
	}};

	const moduleInfo = new ModuleInfo();

	const analyzer = new XMLTemplateAnalyzer(mockPool);
	await analyzer.analyzeFragment(xml, moduleInfo);
	t.deepEqual(moduleInfo.dependencies,
		[
			"sap/ui/core/Fragment.js",
			"sap/ui/layout/HorizontalLayout.js",
			"sap/m/Button.js"
		]);
	t.true(moduleInfo.isImplicitDependency("sap/ui/core/Fragment.js"),
		"Implicit dependency should be added since a fragment is analyzed");
});
