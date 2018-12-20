const {test} = require("ava");
const path = require("path");
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

class CustomResourcePoolWithRejectingModuleInfo extends ResourcePool {
	async getModuleInfo(name) {
		return Promise.reject("myerror");
	}
}

test("findResourceWithInfo", async (t) => {
	const resourcePool = new CustomResourcePoolWithRejectingModuleInfo();
	resourcePool.addResource({name: "a"});
	const resource = await resourcePool.findResourceWithInfo("a");
	t.falsy(resource.info);
	t.deepEqual(resource, {name: "a"});
});

test("getModuleInfo", async (t) => {
	const resourcePool = new ResourcePool();
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
	const inputJsResource = {name: "a.js", buffer: () => code};
	resourcePool.addResource(inputJsResource);

	const xmlFragment = "<HBox xmlns:m=\"sap.m\" xmlns:l=\"sap.ui.layout\" controllerName=\"myController\">" +
		"<items>" +
		"<l:HorizontalLayout id=\"layout\">" +
		"<m:Button text=\"Button 1\" id=\"button1\" />" +
		"<m:Button text=\"Button 2\" id=\"button2\" />" +
		"<m:Button text=\"Button 3\" id=\"button3\" />" +
		"</l:HorizontalLayout>" +
		"</items>" +
		"</HBox>";

	const inputXmlControlResource = {name: "a.control.xml", buffer: () => xmlFragment};
	resourcePool.addResource(inputXmlControlResource);
	const inputXmlFragmentResource = {name: "a.fragment.xml", buffer: () => xmlFragment};
	resourcePool.addResource(inputXmlFragmentResource);

	const xmlView = "<mvc:View xmlns:mvc=\"sap.ui.core.mvc\" xmlns:m=\"sap.m\" xmlns:l=\"sap.ui.layout\" " +
		"controllerName=\"myController\">" +
		"<l:HorizontalLayout id=\"layout\">" +
		"<m:Button text=\"Button 1\" id=\"button1\" />" +
		"<m:Button text=\"Button 2\" id=\"button2\" />" +
		"<m:Button text=\"Button 3\" id=\"button3\" />" +
		"</l:HorizontalLayout>" +
		"</mvc:View>";

	const inputXmlViewResource = {name: "a.view.xml", buffer: () => xmlView};
	resourcePool.addResource(inputXmlViewResource);


	const jsResource = await resourcePool.getModuleInfo("a.js");
	t.deepEqual(jsResource.size, 371);
	t.falsy(jsResource.info);

	const xmlControlResource = await resourcePool.getModuleInfo("a.control.xml");
	t.deepEqual(xmlControlResource.size, 274);
	t.falsy(xmlControlResource.info);

	const xmlFragmentResource = await resourcePool.getModuleInfo("a.fragment.xml");
	t.deepEqual(xmlFragmentResource.size, 274);
	t.falsy(xmlFragmentResource.info);

	const xmlViewResource = await resourcePool.getModuleInfo("a.view.xml");
	t.deepEqual(xmlViewResource.size, 295);
	t.falsy(xmlViewResource.info);
});


test("addResource twice", async (t) => {
	const resourcePool = new ResourcePool();
	resourcePool.addResource({name: "a"});
	resourcePool.addResource({name: "a"});
	t.is(resourcePool.size, 2);
});

test("addRoot", async (t) => {
	const resourcePool = new ResourcePool();
	const root = path.join(__dirname, "..", "..", "..", "fixtures", "sap.ui.core-evo", "main");
	await resourcePool.addRoot(root, "ui5");
	t.is(resourcePool.size, 1);
});

test("addResource library", async (t) => {
	const resourcePool = new ResourcePool();

	const xml = "<?xml version=\"1.0\" encoding=\"UTF-8\" ?>\n" +
		"<library xmlns=\"http://www.sap.com/sap.ui.library.xsd\" >\n" +
		"\n" +
		"\t<name>library.d</name>\n" +
		"\t<vendor>SAP SE</vendor>\n" +
		"\t<copyright>${copyright}</copyright>\n" +
		"\t<version>${version}</version>\n" +
		"\n" +
		"\t<documentation>Library E</documentation>\n" +
		"\n" +
		"<appData>" +
		"   <packaging xmlns=\"http://www.sap.com/ui5/buildext/packaging\" version=\"2.0\" >\n" +
		"       <module-infos>" +
		"           <raw-module name=\"sap/ui/core/support/trace/EppLib.js\" />" +
		"       </module-infos>" +
		"       <all-in-one>\n" +
		"        <exclude name=\"sap/ui/rta/test/controlEnablingCheck.js\" />\n" +
		"      </all-in-one>\n" +
		"    </packaging>" +
		"</appData>" +
		"</library>";

	const resource = {
		name: "a.library",
		buffer: async () => xml
	};
	await resourcePool.addResource(resource);
	t.is(resourcePool.size, 1);
});
