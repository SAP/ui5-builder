import test from "ava";
import {parseJS} from "../../../../lib/lbt/utils/parseUtils.js";
import sinonGlobal from "sinon";
import esmock from "esmock";

test.beforeEach(async (t) => {
	t.context.sinon = sinonGlobal.createSandbox();
	t.context.FioriElementsAnalyzer = await esmock("../../../../lib/lbt/analyzer/FioriElementsAnalyzer.js");
});

test.afterEach.always((t) => {
	t.context.sinon.restore();
});

test("analyze: with Component.js", async (t) => {
	const {FioriElementsAnalyzer} = t.context;
	const emptyPool = {};
	const analyzer = new FioriElementsAnalyzer(emptyPool);
	const name = "sap/ui/core/Component.js";
	const moduleInfo = {};
	const result = await analyzer.analyze({name}, moduleInfo);
	t.deepEqual(result, {}, "moduleInfo was not modified");
});

test("analyze: without manifest", async (t) => {
	const {sinon, FioriElementsAnalyzer} = t.context;

	const mockPool = {
		async findResource() {
			return {
				buffer: async () => {
					throw new Error("Some error");
				}
			};
		}
	};

	const moduleInfo = {};

	const analyzer = new FioriElementsAnalyzer(mockPool);

	const stubAnalyzeManifest = sinon.stub(analyzer, "_analyzeManifest").resolves();

	const name = "MyComponent.js";
	const result = await analyzer.analyze({name}, moduleInfo);

	t.false(stubAnalyzeManifest.called, "_analyzeManifest was not called");
	t.deepEqual(result, {}, "empty module info object expected since resource was not found (rejects)");
});

test("analyze: with manifest", async (t) => {
	const {sinon, FioriElementsAnalyzer} = t.context;

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
	const mockPool = {
		async findResource() {
			return {
				buffer: async () => JSON.stringify(manifest)
			};
		}
	};

	const moduleInfo = {};

	const analyzer = new FioriElementsAnalyzer(mockPool);

	const stubAnalyzeManifest = sinon.stub(analyzer, "_analyzeManifest").resolves();

	const name = "MyComponent.js";
	await analyzer.analyze({name}, moduleInfo);

	t.true(stubAnalyzeManifest.calledOnce, "_analyzeManifest was called once");
	t.deepEqual(stubAnalyzeManifest.getCall(0).args[0], manifest,
		"_analyzeManifest should be called with the manifest");
});

test("_analyzeManifest: Manifest with TemplateAssembler code", async (t) => {
	const {sinon, FioriElementsAnalyzer} = t.context;

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

	const moduleInfo = {
		addDependency: function() {}
	};
	const stubAddDependency = sinon.spy(moduleInfo, "addDependency");

	const analyzer = new FioriElementsAnalyzer();

	const stubAnalyzeTemplateComponent = sinon.stub(analyzer, "_analyzeTemplateComponent").resolves();

	await analyzer._analyzeManifest(manifest, moduleInfo);

	t.true(stubAnalyzeTemplateComponent.calledOnce, "_analyzeManifest was called once");
	t.is(stubAnalyzeTemplateComponent.getCall(0).args[0], "sap/fe/templates/MyTmpl/Component.js",
		"_analyzeManifest should be called with the module name");

	t.deepEqual(stubAnalyzeTemplateComponent.getCall(0).args[1], {
		"template": "MyTmpl"
	}, "_analyzeManifest should be called with the actionCfg");

	t.deepEqual(stubAnalyzeTemplateComponent.getCall(0).args[2], moduleInfo,
		"_analyzeManifest should be called with moduleInfo");

	t.true(stubAddDependency.calledOnce, "addDependency was called once");
	t.is(stubAddDependency.getCall(0).args[0], "sap/fe/templates/MyTmpl/Component.js",
		"addDependency should be called with the dependency name");
});

test("_analyzeManifest: Manifest with entitySet key", async (t) => {
	const {FioriElementsAnalyzer} = t.context;

	const manifest = {
		"sap.fe": {
			"entitySets": [{
				"entitySet": "123"
			}]
		}
	};

	const moduleInfo = {};
	const analyzer = new FioriElementsAnalyzer();
	const result = await analyzer._analyzeManifest(manifest, moduleInfo);
	t.deepEqual(result, [], "resolves with an empty array");
});


test.serial("_analyzeTemplateComponent: Manifest with TemplateAssembler code", async (t) => {
	const {sinon, FioriElementsAnalyzer} = t.context;

	const moduleInfo = {
		addDependency: function() {}
	};
	const stubAddDependency = sinon.spy(moduleInfo, "addDependency");

	const mockPool = {
		async findResource() {
			return {
				buffer: async () => ""
			};
		}
	};

	const analyzer = new FioriElementsAnalyzer(mockPool);

	const stubAnalyzeAST = sinon.stub(analyzer, "_analyzeAST").returns("mytpl");

	await analyzer._analyzeTemplateComponent("pony",
		{}, moduleInfo);

	t.true(stubAnalyzeAST.calledOnce, "_analyzeManifest was called once");
	t.is(stubAnalyzeAST.getCall(0).args[0], "pony",
		"_analyzeManifest should be called with the module name");


	t.true(stubAddDependency.calledOnce, "addDependency was called once");
	t.is(stubAddDependency.getCall(0).args[0], "mytpl.view.xml",
		"addDependency should be called with the dependency name");
});

test.serial("_analyzeTemplateComponent: no default template name", async (t) => {
	const {sinon, FioriElementsAnalyzer} = t.context;

	const moduleInfo = {
		addDependency: function() {}
	};
	const stubAddDependency = sinon.spy(moduleInfo, "addDependency");

	const mockPool = {
		async findResource() {
			return {
				buffer: async () => ""
			};
		}
	};

	const analyzer = new FioriElementsAnalyzer(mockPool);

	const stubAnalyzeAST = sinon.stub(analyzer, "_analyzeAST").returns("");

	await analyzer._analyzeTemplateComponent("pony",
		{}, moduleInfo);

	t.true(stubAnalyzeAST.calledOnce, "_analyzeManifest was called once");

	t.true(stubAddDependency.notCalled, "addDependency was not called");
});

test.serial("_analyzeTemplateComponent: with template name from pageConfig", async (t) => {
	const {sinon, FioriElementsAnalyzer} = t.context;

	const moduleInfo = {
		addDependency: function() {}
	};
	const stubAddDependency = sinon.spy(moduleInfo, "addDependency");

	const mockPool = {
		async findResource() {
			return {
				buffer: async () => ""
			};
		}
	};

	const analyzer = new FioriElementsAnalyzer(mockPool);

	const stubAnalyzeAST = sinon.stub(analyzer, "_analyzeAST").returns("");

	await analyzer._analyzeTemplateComponent("pony", {
		component: {
			settings: {
				templateName: "donkey"
			}
		}
	}, moduleInfo);

	t.true(stubAnalyzeAST.calledOnce, "_analyzeManifest was called once");

	t.true(stubAddDependency.calledOnce, "addDependency was called once");
	t.is(stubAddDependency.getCall(0).args[0], "donkey.view.xml",
		"addDependency should be called with the dependency name");
});

test("_analyzeAST: get template name from ast", (t) => {
	const {FioriElementsAnalyzer} = t.context;
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
	const ast = parseJS(code);
	const analyzer = new FioriElementsAnalyzer();
	const templateName = analyzer._analyzeAST("sap.fe.templates.Page.Component", ast);
	t.is(templateName, "sap.fe.templates.Page.view.Page");
});

test("_analyzeAST: get template name from ast (AMD define)", (t) => {
	const {FioriElementsAnalyzer} = t.context;
	const code = `define(["a", "sap/fe/core/TemplateAssembler"], function(a, TemplateAssembler){
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
	const ast = parseJS(code);
	const analyzer = new FioriElementsAnalyzer();
	const templateName = analyzer._analyzeAST("sap.fe.templates.Page.Component", ast);
	t.is(templateName, "sap.fe.templates.Page.view.Page");
});

test("_analyzeAST: unable to get template name from ast (no TemplateAssembler import)", (t) => {
	const {FioriElementsAnalyzer} = t.context;
	const code = `sap.ui.define(["a"], // import missing
		function(a, TemplateAssembler){
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
	const ast = parseJS(code);
	const analyzer = new FioriElementsAnalyzer();
	const templateName = analyzer._analyzeAST("sap.fe.templates.Page.Component", ast);
	t.is(templateName, "");
});

test("_analyzeAST: unable to get template name from ast (no module definition)", (t) => {
	const {FioriElementsAnalyzer} = t.context;
	const code = `myDefine(["a", "sap/fe/core/TemplateAssembler"], // unsupported module definition
		function(a, TemplateAssembler){
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
	const ast = parseJS(code);
	const analyzer = new FioriElementsAnalyzer();
	const templateName = analyzer._analyzeAST("sap.fe.templates.Page.Component", ast);
	t.is(templateName, "");
});

test("_analyzeAST: unable to get template name from ast (ArrowFunction with implicit return #1)", (t) => {
	const {FioriElementsAnalyzer} = t.context;
	const code = `sap.ui.define(["a", "sap/fe/core/TemplateAssembler"],
	(a, TemplateAssembler) => TemplateAssembler.getTemplateComponent(getMethods,
		"sap.fe.templates.Page.Component", {
			metadata: {
				// No templateName provided
				"manifest": "json"
			}
		}));`;
	const ast = parseJS(code);
	const analyzer = new FioriElementsAnalyzer();
	const templateName = analyzer._analyzeAST("sap.fe.templates.Page.Component", ast);
	t.is(templateName, "");
});

test("_analyzeAST: unable to get template name from ast (ArrowFunction with implicit return #2)", (t) => {
	const {FioriElementsAnalyzer} = t.context;
	const code = `sap.ui.define(["a", "sap/fe/core/TemplateAssembler"],
	(a, TemplateAssembler) => TemplateAssembler.extend(getMethods, // wrong call. should be 'getTemplateComponent'
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
		}));`;
	const ast = parseJS(code);
	const analyzer = new FioriElementsAnalyzer();
	const templateName = analyzer._analyzeAST("sap.fe.templates.Page.Component", ast);
	t.is(templateName, "");
});

test.serial("_analyzeAST: get template name from ast (async function)", (t) => {
	const {FioriElementsAnalyzer} = t.context;
	const code = `sap.ui.define(["a", "sap/fe/core/TemplateAssembler"], async function(a, TemplateAssembler){
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
	const ast = parseJS(code);
	const analyzer = new FioriElementsAnalyzer();
	const templateName = analyzer._analyzeAST("sap.fe.templates.Page.Component", ast);
	t.is(templateName, "sap.fe.templates.Page.view.Page");
});

test.serial("_analyzeAST: get template name from ast (async ArrowFunction)", (t) => {
	const {FioriElementsAnalyzer} = t.context;
	const code = `sap.ui.define(["a", "sap/fe/core/TemplateAssembler"], async (a, TemplateAssembler) => {
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
	const ast = parseJS(code);
	const analyzer = new FioriElementsAnalyzer();
	const templateName = analyzer._analyzeAST("sap.fe.templates.Page.Component", ast);
	t.is(templateName, "sap.fe.templates.Page.view.Page");
});

test.serial("_analyzeAST: get template name from ast (async ArrowFunction with implicit return)", (t) => {
	const {FioriElementsAnalyzer} = t.context;
	const code = `sap.ui.define(["a", "sap/fe/core/TemplateAssembler"],
	async (a, TemplateAssembler) => TemplateAssembler.getTemplateComponent(getMethods,
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
		}));`;
	const ast = parseJS(code);
	const analyzer = new FioriElementsAnalyzer();
	const templateName = analyzer._analyzeAST("sap.fe.templates.Page.Component", ast);
	t.is(templateName, "sap.fe.templates.Page.view.Page");
});

test("_analyzeAST: get template name from ast (ArrowFunction)", (t) => {
	const {FioriElementsAnalyzer} = t.context;
	const code = `sap.ui.define(["a", "sap/fe/core/TemplateAssembler"], (a, TemplateAssembler) => {
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
	const ast = parseJS(code);
	const analyzer = new FioriElementsAnalyzer();
	const templateName = analyzer._analyzeAST("sap.fe.templates.Page.Component", ast);
	t.is(templateName, "sap.fe.templates.Page.view.Page");
});

test("_analyzeAST: get template name from ast (ArrowFunction with implicit return)", (t) => {
	const {FioriElementsAnalyzer} = t.context;
	const code = `sap.ui.define(["a", "sap/fe/core/TemplateAssembler"],
	(a, TemplateAssembler) => TemplateAssembler.getTemplateComponent(getMethods,
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
		}));`;
	const ast = parseJS(code);
	const analyzer = new FioriElementsAnalyzer();
	const templateName = analyzer._analyzeAST("sap.fe.templates.Page.Component", ast);
	t.is(templateName, "sap.fe.templates.Page.view.Page");
});

test("_analyzeAST: get template name from ast (with SpreadElement)", (t) => {
	const {FioriElementsAnalyzer} = t.context;
	const code = `sap.ui.define(["a", "sap/fe/core/TemplateAssembler"], (a, TemplateAssembler) => {
		const myTemplate = {
			templateName: {
				type: "string",
				defaultValue: "sap.fe.templates.Page.view.Page"
			}
		};
		return TemplateAssembler.getTemplateComponent(getMethods,
		"sap.fe.templates.Page.Component", {
			metadata: {
				properties: {
					...myTemplate
				},
				"manifest": "json"
			}
		});});`;
	const ast = parseJS(code);
	const analyzer = new FioriElementsAnalyzer();
	const templateName = analyzer._analyzeAST("sap.fe.templates.Page.Component", ast);

	t.is(templateName, "", "The TemplateName is correctly empty as SpreadElements are not supported");
});

test("_analyzeAST: no template name from ast", (t) => {
	const {sinon, FioriElementsAnalyzer} = t.context;
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
	const ast = parseJS(code);

	const analyzer = new FioriElementsAnalyzer();

	const stubAnalyzeTemplateClassDefinition = sinon.stub(analyzer,
		"_analyzeTemplateClassDefinition").returns(false);

	const result = analyzer._analyzeAST("pony", ast);

	t.true(stubAnalyzeTemplateClassDefinition.calledOnce, "_analyzeTemplateClassDefinition was called once");

	stubAnalyzeTemplateClassDefinition.restore();
	t.is(result, "");
});

test("_analyzeTemplateClassDefinition: get template name from metadata", async (t) => {
	const {FioriElementsAnalyzer} = t.context;
	const code = `var x = {
			metadata: {
				properties: {
					"templateName": {
						"type": "string",
						"defaultValue": "sap.fe.templates.Page.view.Page"
					}
				},
				"manifest": "json"
			}
		};`;
	const ast = parseJS(code);
	const expression = ast.body[0].declarations[0].init;

	const analyzer = new FioriElementsAnalyzer();

	const result = await analyzer._analyzeTemplateClassDefinition(expression);

	t.is(result, "sap.fe.templates.Page.view.Page", "defaultValue is retrieved");
});

test("_analyzeTemplateClassDefinition: no string template name from metadata", async (t) => {
	const {FioriElementsAnalyzer} = t.context;
	const code = `var x = {
			metadata: {
				properties: {
					"templateName": {
						"type": "string",
						"defaultValue": false
					}
				},
				"manifest": "json"
			}
		};`;
	const ast = parseJS(code);
	const expression = ast.body[0].declarations[0].init;

	const analyzer = new FioriElementsAnalyzer();

	const result = await analyzer._analyzeTemplateClassDefinition(expression);

	t.falsy(result, "defaultValue is not a string");
});
