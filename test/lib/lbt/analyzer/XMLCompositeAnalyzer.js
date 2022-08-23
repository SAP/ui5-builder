const test = require("ava");
const {parseJS} = require("../../../../lib/lbt/utils/parseUtils");
const sinon = require("sinon");
const XMLCompositeAnalyzer = require("../../../../lib/lbt/analyzer/XMLCompositeAnalyzer");
const ModuleInfo = require("../../../../lib/lbt/resources/ModuleInfo");

test("integration: XMLComposite code", async (t) => {
	const code = `sap.ui.define([
		'jquery.sap.global', 'sap/ui/core/XMLComposite'],
		function(jQuery, XMLComposite) {
		"use strict";
		var ButtonList = XMLComposite.extend("composites.ButtonList", {});
		return ButtonList;
	});`;

	const ast = parseJS(code);

	const analyzer = new XMLCompositeAnalyzer();
	const name = "composites.ButtonList";
	const moduleInfo = new ModuleInfo();
	await analyzer.analyze(ast, name, moduleInfo);
	t.deepEqual(moduleInfo.dependencies, ["composites/ButtonList.control.xml"],
		"Dependency should be created from composite name");
});

test("integration: XMLComposite code without VariableDeclaration", async (t) => {
	const code = `sap.ui.define([
		'jquery.sap.global', 'sap/ui/core/XMLComposite'],
		function(jQuery, XMLComposite) {
		"use strict";
		return XMLComposite.extend("composites.ButtonList", {});
	});`;

	const ast = parseJS(code);

	const analyzer = new XMLCompositeAnalyzer();
	const name = "composites.ButtonList";
	const moduleInfo = new ModuleInfo();
	await analyzer.analyze(ast, name, moduleInfo);
	t.deepEqual(moduleInfo.dependencies, ["composites/ButtonList.control.xml"],
		"Dependency should be created from composite name");
});

test("integration: XMLComposite code without VariableDeclaration (async function)", async (t) => {
	const code = `sap.ui.define([
		'jquery.sap.global', 'sap/ui/core/XMLComposite'],
		async function(jQuery, XMLComposite) {
		"use strict";
		return XMLComposite.extend("composites.ButtonList", {});
	});`;

	const ast = parseJS(code);

	const analyzer = new XMLCompositeAnalyzer();
	const name = "composites.ButtonList";
	const moduleInfo = new ModuleInfo();
	await analyzer.analyze(ast, name, moduleInfo);
	t.deepEqual(moduleInfo.dependencies, ["composites/ButtonList.control.xml"],
		"Dependency should be created from composite name");
});

test("integration: XMLComposite code with arrow function", async (t) => {
	const code = `sap.ui.define([
		'jquery.sap.global', 'sap/ui/core/XMLComposite'],
		(jQuery, XMLComposite) => {
		return XMLComposite.extend("composites.ButtonList", {});
	});`;

	const ast = parseJS(code);

	const analyzer = new XMLCompositeAnalyzer();
	const name = "composites.ButtonList";
	const moduleInfo = new ModuleInfo();
	await analyzer.analyze(ast, name, moduleInfo);
	t.deepEqual(moduleInfo.dependencies, ["composites/ButtonList.control.xml"],
		"Dependency should be created from composite name");
});

test("integration: XMLComposite code with async arrow function", async (t) => {
	const code = `sap.ui.define([
		'jquery.sap.global', 'sap/ui/core/XMLComposite'],
		async(jQuery, XMLComposite) => {
		return XMLComposite.extend("composites.ButtonList", {});
	});`;

	const ast = parseJS(code);

	const analyzer = new XMLCompositeAnalyzer();
	const name = "composites.ButtonList";
	const moduleInfo = new ModuleInfo();
	await analyzer.analyze(ast, name, moduleInfo);
	t.deepEqual(moduleInfo.dependencies, ["composites/ButtonList.control.xml"],
		"Dependency should be created from composite name");
});

test("integration: XMLComposite code with arrow function with implicit return", async (t) => {
	const code = `sap.ui.define([
		'jquery.sap.global', 'sap/ui/core/XMLComposite'],
		(jQuery, XMLComposite) => XMLComposite.extend("composites.ButtonList", {}));`;

	const ast = parseJS(code);

	const analyzer = new XMLCompositeAnalyzer();
	const name = "composites.ButtonList";
	const moduleInfo = new ModuleInfo();
	await analyzer.analyze(ast, name, moduleInfo);
	t.deepEqual(moduleInfo.dependencies, ["composites/ButtonList.control.xml"],
		"Dependency should be created from composite name");
});

test("integration: XMLComposite code with SpreadElement", async (t) => {
	const code = `sap.ui.define([
		'jquery.sap.global', 'sap/ui/core/XMLComposite'],
		(jQuery, XMLComposite) => {
		const myXMLComposite = {
			fragment: "composites.custom.ButtonList"
		};
		return XMLComposite.extend("composites.ButtonList", {
			...myXMLComposite
		});
	});`;


	const ast = parseJS(code);

	const analyzer = new XMLCompositeAnalyzer();
	const name = "composites.ButtonList";
	const moduleInfo = new ModuleInfo();
	await analyzer.analyze(ast, name, moduleInfo);

	t.deepEqual(moduleInfo.dependencies, ["composites/ButtonList.control.xml"],
		"Dependency should be created from composite name because overriden by the 'fragment' property " +
		" is not possible to lacking SpreadElement support");

	// TODO: Support SpreadElement
	// t.deepEqual(moduleInfo.dependencies, ["composites/custom/ButtonList.control.xml"],
	// 	"Dependency should be created from composite name");
});

test("analyze: not an XMLComposite module", async (t) => {
	const code = `sap.ui.define([
		'jquery.sap.global', 'sap/ui/core/XMLComposite'],
		function(jQuery, XMLComposite) {
		"use strict";
		return {};
	});`;

	const ast = parseJS(code);

	const moduleInfo = {
		addDependency: function() {}
	};
	const stubAddDependency = sinon.spy(moduleInfo, "addDependency");

	const analyzer = new XMLCompositeAnalyzer();
	const stubCheckForXMLCClassDefinition = sinon.stub(analyzer, "_checkForXMLCClassDefinition").returns("cow");
	const name = "composites.ButtonList";
	await analyzer.analyze(ast, name, moduleInfo);
	t.false(stubCheckForXMLCClassDefinition.called, "_checkForXMLCClassDefinition was not called");
	t.false(stubAddDependency.called, "addDependency was not called");
});

test("analyze: XMLComposite VariableDeclaration code", async (t) => {
	const code = `sap.ui.define([
		'jquery.sap.global', 'sap/ui/core/XMLComposite'],
		function(jQuery, XMLComposite) {
		"use strict";
		var ButtonList = XMLComposite.extend("composites.ButtonList", {});
		return ButtonList;
	});`;

	const ast = parseJS(code);

	const moduleInfo = {
		addDependency: function() {}
	};
	const stubAddDependency = sinon.spy(moduleInfo, "addDependency");

	const analyzer = new XMLCompositeAnalyzer();
	const stubCheckForXMLCClassDefinition = sinon.stub(analyzer, "_checkForXMLCClassDefinition").returns("cow");
	const name = "composites.ButtonList";
	await analyzer.analyze(ast, name, moduleInfo);
	t.true(stubCheckForXMLCClassDefinition.calledOnce, "_checkForXMLCClassDefinition was called once");
	t.is(stubCheckForXMLCClassDefinition.getCall(0).args[0], "XMLComposite",
		"_checkForXMLCClassDefinition should be called with the name");


	t.true(stubAddDependency.calledOnce, "addDependency was called once");
	t.is(stubAddDependency.getCall(0).args[0], "cow.control.xml",
		"addDependency should be called with the dependency name");
});


test("analyze: XMLComposite Expression code", async (t) => {
	const code = `sap.ui.define([
		'jquery.sap.global', 'sap/ui/core/XMLComposite'],
		function(jQuery, XMLComposite) {
		"use strict";
		jQuery.sap.test = XMLComposite.extend("composites.ButtonList", {});
	});`;

	const ast = parseJS(code);

	const moduleInfo = {
		addDependency: function() {}
	};
	const stubAddDependency = sinon.spy(moduleInfo, "addDependency");

	const analyzer = new XMLCompositeAnalyzer();
	const stubCheckForXMLCClassDefinition = sinon.stub(analyzer, "_checkForXMLCClassDefinition").returns("cow");
	const name = "composites.ButtonList";
	await analyzer.analyze(ast, name, moduleInfo);
	t.true(stubCheckForXMLCClassDefinition.calledOnce, "_checkForXMLCClassDefinition was called once");
	t.is(stubCheckForXMLCClassDefinition.getCall(0).args[0], "XMLComposite",
		"_checkForXMLCClassDefinition should be called with the name");


	t.true(stubAddDependency.calledOnce, "addDependency was called once");
	t.is(stubAddDependency.getCall(0).args[0], "cow.control.xml",
		"addDependency should be called with the dependency name");
});

test("_checkForXMLCClassDefinition: string argument and object expression", (t) => {
	const code = `XMLComposite.extend("composites.ButtonList", {})`;

	const ast = parseJS(code);

	const analyzer = new XMLCompositeAnalyzer();
	const stubAnalyzeXMLCClassDefinition = sinon.stub(analyzer, "_analyzeXMLCClassDefinition").returns("cow");
	const result = analyzer._checkForXMLCClassDefinition("XMLComposite", ast.body[0].expression);
	t.true(stubAnalyzeXMLCClassDefinition.calledOnce, "_checkForXMLCClassDefinition was called once");

	t.is(result, "cow",
		"addDependency should be called with the dependency name");
});

test("_checkForXMLCClassDefinition: string argument (template literal)", (t) => {
	const code = `XMLComposite.extend(\`composites.ButtonList\`, {})`;
	const ast = parseJS(code);
	const analyzer = new XMLCompositeAnalyzer();
	const fragmentName = analyzer._checkForXMLCClassDefinition("XMLComposite", ast.body[0].expression);
	t.is(fragmentName, "composites.ButtonList");
});

test("_analyzeXMLCClassDefinition: name retrieval", (t) => {
	const code = `test({fragment: "cat"})`;

	const ast = parseJS(code);

	const analyzer = new XMLCompositeAnalyzer();
	const result = analyzer._analyzeXMLCClassDefinition(ast.body[0].expression.arguments[0]);

	t.is(result, "cat",
		"addDependency should be called with the dependency name");
});

test("_analyzeXMLCClassDefinition: name retrieval (template literal)", (t) => {
	const code = `test({fragment: \`cat\`})`;

	const ast = parseJS(code);

	const analyzer = new XMLCompositeAnalyzer();
	const result = analyzer._analyzeXMLCClassDefinition(ast.body[0].expression.arguments[0]);

	t.is(result, "cat",
		"addDependency should be called with the dependency name");
});
