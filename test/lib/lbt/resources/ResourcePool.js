const {test} = require("ava");
const ResourcePool = require("../../../../lib/lbt/resources/ResourcePool");
const ResourceFilterList = require("../../../../lib/lbt/resources/ResourceFilterList");

test("findResources", async (t) => {
	const resourcePool = new ResourcePool();
	const resourcesFromFilterList = await resourcePool.findResources(new ResourceFilterList(["a"]));
	t.deepEqual(resourcesFromFilterList, []);

	const resources = await resourcePool.findResources("a");
	t.deepEqual(resources, []);
});

test("size", async (t) => {
	const resourcePool = new ResourcePool();
	const resourcesFromFilterList = resourcePool.size;
	t.deepEqual(resourcesFromFilterList, 0);
});

test("resources", async (t) => {
	const resourcePool = new ResourcePool();
	const resourcesFromFilterList = resourcePool.resources;
	t.deepEqual(resourcesFromFilterList, []);
});

class ResourcePoolWithRejectingModuleInfo extends ResourcePool {
	async getModuleInfo(name) {
		return Promise.reject("myerror");
	}
}

test("findResourceWithInfo with rejecting getModuleInfo", async (t) => {
	const resourcePool = new ResourcePoolWithRejectingModuleInfo();
	resourcePool.addResource({name: "a"});
	const resource = await resourcePool.findResourceWithInfo("a");
	t.falsy(resource.info);
	t.deepEqual(resource, {name: "a"});
});

test("getModuleInfo", async (t) => {
	const resourcePool = new ResourcePool();
	const inputJsResource = {name: "a.js", buffer: () => ""};
	resourcePool.addResource(inputJsResource);
	const jsResource = await resourcePool.getModuleInfo("a.js");
	t.deepEqual(jsResource.size, 0);
	t.falsy(jsResource.format);
	t.deepEqual(jsResource.name, "a.js");
	t.true(jsResource.rawModule);
	t.deepEqual(jsResource.subModules, []);
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
	const inputJsResource = {name: "a.js", buffer: () => code};
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
	t.deepEqual(jsResource.format, "ui5-define");
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
	resourcePool.addResource({name: "a"});
	resourcePool.addResource({name: "a"});
	t.is(resourcePool.size, 2);
	t.deepEqual(resourcePool.resources, [{name: "a"}, {name: "a"}]);
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
		            <raw-module name="sap/ui/core/support/trace/EppLib.js" />       
		       </module-infos>       
		       <all-in-one>
		            <exclude name="sap/ui/rta/test/controlEnablingCheck.js" />
		      </all-in-one>
	        </packaging>
        </appData>
    </library>`;

	const resource = {
		name: "a.library",
		buffer: async () => xml
	};
	await resourcePool.addResource(resource);
	t.is(resourcePool.size, 1);
	t.deepEqual(resourcePool.resources, [resource]);
});
