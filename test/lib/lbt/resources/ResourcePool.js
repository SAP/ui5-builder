const {test} = require("ava");
const ResourcePool = require("../../../../lib/lbt/resources/ResourcePool");
const ResourceFilterList = require("../../../../lib/lbt/resources/ResourceFilterList");

test("findResources with pattern", async (t) => {
	const resourcePool = new ResourcePool();

	const resourcesOfEmptyPool = await resourcePool.findResources(/a/);
	t.deepEqual(resourcesOfEmptyPool, [], "nothing is found in empty pool");


	const resourceA = {name: "a"};
	resourcePool.addResource(resourceA);

	const resources = await resourcePool.findResources(/a/);
	t.deepEqual(resources, [resourceA], "resource a is found");
});

test("findResources with ResourceFilterList", async (t) => {
	const resourcePool = new ResourcePool();
	const resourcesOfEmptyPool = await resourcePool.findResources(new ResourceFilterList(["a"]));
	t.deepEqual(resourcesOfEmptyPool, [], "nothing is found in empty pool");

	const resourceA = {name: "a"};
	resourcePool.addResource(resourceA);
	const resources = await resourcePool.findResources(new ResourceFilterList(["a"]));
	t.deepEqual(resources, [resourceA], "resource a is found");
});

test("size", async (t) => {
	const resourcePool = new ResourcePool();
	t.is(resourcePool.size, 0, "size of empty pool is 0");

	const resourceA = {name: "a"};
	resourcePool.addResource(resourceA);
	t.is(resourcePool.size, 1, "size of pool is 1");
});

test("resources", async (t) => {
	const resourcePool = new ResourcePool();
	t.deepEqual(resourcePool.resources, [], "no resources in empty pool");

	const resourceA = {name: "a"};
	resourcePool.addResource(resourceA);
	t.deepEqual(resourcePool.resources, [resourceA], "resource a in pool");
});

class ResourcePoolWithRejectingModuleInfo extends ResourcePool {
	async getModuleInfo(name) {
		return Promise.reject("myerror");
	}
}

test("findResourceWithInfo with rejecting getModuleInfo", async (t) => {
	const resourcePool = new ResourcePoolWithRejectingModuleInfo();
	const resourceA = {name: "a"};
	resourcePool.addResource(resourceA);
	const resource = await resourcePool.findResourceWithInfo("a");
	t.falsy(resource.info, "in the rejection case the info is not there");
	t.deepEqual(resource, resourceA, "Although info was rejected resource is still found");
});

test("getModuleInfo", async (t) => {
	const resourcePool = new ResourcePool();
	const code = "var test = 47;";
	const inputJsResource = {name: "a.js", buffer: async () => code};
	resourcePool.addResource(inputJsResource);
	const jsResource = await resourcePool.getModuleInfo("a.js");
	t.deepEqual(jsResource.name, inputJsResource.name, "name should be the same");
	t.deepEqual(jsResource.size, code.length, "size is the character length of code");
	t.true(jsResource.rawModule);
	t.deepEqual(jsResource.subModules, [], "does not contain submodules");
});

test("getModuleInfo with determineDependencyInfo", async (t) => {
	const resourcePool = new ResourcePool();
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
		});
	});`;
	const inputJsResource = {name: "a.js", buffer: async () => code};
	resourcePool.addResource(inputJsResource);

	const xmlFragment = `<HBox xmlns:m="sap.m" xmlns:l="sap.ui.layout" controllerName="myController">
		<items>
		<l:HorizontalLayout id="layout">
		<m:Button text="Button 1" id="button1" />
		<m:Button text="Button 2" id="button2" />
		<m:Button text="Button 3" id="button3" />
		</l:HorizontalLayout>
		</items>
		</HBox>`;

	const inputXmlControlResource = {name: "a.control.xml", buffer: () => xmlFragment};
	resourcePool.addResource(inputXmlControlResource);
	const inputXmlFragmentResource = {name: "a.fragment.xml", buffer: () => xmlFragment};
	resourcePool.addResource(inputXmlFragmentResource);

	const xmlView = `<mvc:View xmlns:mvc="sap.ui.core.mvc" xmlns:m="sap.m" xmlns:l="sap.ui.layout" controllerName="myController">
		<l:HorizontalLayout id="layout">
		<m:Button text="Button 1" id="button1" />
		<m:Button text="Button 2" id="button2" />
		<m:Button text="Button 3" id="button3" />
		</l:HorizontalLayout>
		</mvc:View>`;

	const inputXmlViewResource = {name: "a.view.xml", buffer: () => xmlView};
	resourcePool.addResource(inputXmlViewResource);


	const jsResource = await resourcePool.getModuleInfo("a.js");
	t.deepEqual(jsResource.size, 375);
	t.deepEqual(jsResource.format, "ui5-define", "contains sap.ui.define therefore should be a ui5-define format");
	t.deepEqual(jsResource.name, "a.js");
	t.false(jsResource.rawModule);
	t.deepEqual(jsResource.subModules, []);

	const xmlControlResource = await resourcePool.getModuleInfo("a.control.xml");
	t.deepEqual(xmlControlResource.size, 298);
	t.falsy(xmlControlResource.format);
	t.deepEqual(xmlControlResource.name, "a.control.xml");
	t.false(xmlControlResource.rawModule);
	t.deepEqual(xmlControlResource.subModules, []);

	const xmlFragmentResource = await resourcePool.getModuleInfo("a.fragment.xml");
	t.deepEqual(xmlFragmentResource.size, 298);
	t.falsy(xmlControlResource.format);
	t.deepEqual(xmlFragmentResource.name, "a.fragment.xml");
	t.false(xmlFragmentResource.rawModule);
	t.deepEqual(xmlFragmentResource.subModules, []);

	const xmlViewResource = await resourcePool.getModuleInfo("a.view.xml");
	t.deepEqual(xmlViewResource.size, 313);
	t.falsy(xmlControlResource.format);
	t.deepEqual(xmlViewResource.name, "a.view.xml");
	t.false(xmlViewResource.rawModule);
	t.deepEqual(xmlViewResource.subModules, []);
});


test("addResource twice", async (t) => {
	const resourcePool = new ResourcePool();
	const resourceA = {name: "a"};
	resourcePool.addResource(resourceA);
	resourcePool.addResource(resourceA);
	t.is(resourcePool.size, 2, "there should be 2 resources");
	t.deepEqual(resourcePool.resources, [resourceA, resourceA]);
});

test("addResource library", async (t) => {
	const resourcePool = new ResourcePool();

	const xml = `<?xml version="1.0" encoding="UTF-8" ?>
	<library xmlns="http://www.sap.com/sap.ui.library.xsd" >
	<name>library.d</name>
	<vendor>SAP SE</vendor>
	<copyright>\${copyright}</copyright>
	<version>\${version}</version>
	<documentation>Library E</documentation>
		<appData>   
			<packaging xmlns="http://www.sap.com/ui5/buildext/packaging" version="2.0" >
		       <module-infos>           
		            <raw-module name="sap/ui/core/support/trace/EppLib.js" depends="sap/ui/thirdparty/jquery.js"/>
		       </module-infos>       
	        </packaging>
        </appData>
    </library>`;

	const library = {
		name: "a.library",
		buffer: async () => xml
	};
	const eppLib = {name: "sap/ui/core/support/trace/EppLib.js"};
	// when library is added its xml is processed and eppLib and its dependency is added
	await resourcePool.addResource(library);
	await resourcePool.addResource(eppLib);
	t.is(resourcePool.size, 2);
	t.deepEqual(resourcePool.resources, [library, eppLib]);

	const libraryInfo = await resourcePool.getModuleInfo("a.library");
	t.false(libraryInfo.rawModule);
	t.deepEqual(libraryInfo.dependencies, [], "a.library does not have a dependency");

	const eppLibInfo = await resourcePool.getModuleInfo("sap/ui/core/support/trace/EppLib.js");
	t.false(eppLibInfo.rawModule);
	t.deepEqual(eppLibInfo.dependencies, ["sap/ui/thirdparty/jquery.js"], "Contains dependency to jquery");
});
