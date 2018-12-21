const {test} = require("ava");
const XMLTemplateAnalyzer = require("../../../../lib/lbt/analyzer/XMLTemplateAnalyzer");


test("analyzeView", async (t) => {
	t.plan(3);

	const xml = `<mvc:View xmlns:mvc="sap.ui.core.mvc" xmlns:m="sap.m" xmlns:l="sap.ui.layout" controllerName="myController">
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

	const aDependencies = [];
	const mockInfo = {
		addDependency(name) {
			aDependencies.push(name);
		},
		addImplicitDependency(name) {
			t.is(name, "sap/ui/core/mvc/XMLView.js");
		}
	};

	const subject = new XMLTemplateAnalyzer(mockPool);
	const oResult = await subject.analyzeView(xml, mockInfo);
	t.deepEqual(oResult, mockInfo);
	t.deepEqual(aDependencies,
		[
			"myController.controller.js",
			"sap/ui/layout/HorizontalLayout.js",
			"sap/m/Button.js",
			"sap/m/Button.js",
			"sap/m/Button.js"
		]);
});

test("analyzeFragment", async (t) => {
	t.plan(3);


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

	const aDependencies = [];
	const mockInfo = {
		addDependency(name) {
			aDependencies.push(name);
		},
		addImplicitDependency(name) {
			t.is(name, "sap/ui/core/Fragment.js");
		}
	};

	const subject = new XMLTemplateAnalyzer(mockPool);
	const oResult = await subject.analyzeFragment(xml, mockInfo);
	t.deepEqual(oResult, mockInfo);
	t.deepEqual(aDependencies,
		["sap/ui/layout/HorizontalLayout.js", "sap/m/Button.js", "sap/m/Button.js", "sap/m/Button.js"]);
});
