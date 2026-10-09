/* eslint-disable max-len */
import test from "ava";
import esmock from "esmock";
import sinonGlobal from "sinon";

test.beforeEach(async (t) => {
	t.context.sinon = sinonGlobal.createSandbox();
	t.context.transformApiJson = await esmock("../../../../../lib/processors/jsdoc/lib/transformApiJson.cjs");
});

test.afterEach.always((t) => {
	t.context.sinon.restore();
});

test("Basic test without symbols", async (t) => {
	const {sinon, transformApiJson} = t.context;

	const apiJsonPath = "/test-resources/sap/ui5/tooling/test/designtime/api.json";
	const fakeTargetPath = "/ignore/this/path/resource/will/be/returned";
	const dotLibraryPath = "/resources/sap/ui5/tooling/test/.library";
	const dependencyApiJsonPaths = [];

	const readFile = sinon.stub().yieldsAsync(new Error("Not found!"));

	readFile.withArgs("/resources/sap/ui5/tooling/test/.library").yieldsAsync(null, `
		<?xml version="1.0" encoding="UTF-8" ?>
		<library xmlns="http://www.sap.com/sap.ui.library.xsd" >

			<name>sap.ui5.tooling.test</name>
			<vendor>SAP SE</vendor>
			<copyright>Some copyright notice</copyright>
			<version>1.2.3</version>

			<documentation>UI5 Tooling Test Library</documentation>

		</library>`
	);

	readFile.withArgs("/test-resources/sap/ui5/tooling/test/designtime/api.json").yieldsAsync(null, JSON.stringify(
		{
			"$schema-ref": "http://schemas.sap.com/sapui5/designtime/api.json/1.0",
			"version": "2.1.0",
			"library": "sap.ui5.tooling.test",
			"symbols": []
		}
	));

	const readdir = sinon.stub().yieldsAsync(new Error("Not found!"));

	const fs = {readFile, readdir};

	const apiJsonContent = await transformApiJson(
		apiJsonPath, fakeTargetPath, dotLibraryPath, dependencyApiJsonPaths, "", {
			fs,
			returnOutputFiles: true
		}
	);

	t.deepEqual(JSON.parse(apiJsonContent), {
		"$schema-ref": "http://schemas.sap.com/sapui5/designtime/api.json/1.0",
		"version": "2.1.0",
		"library": "sap.ui5.tooling.test",
		"symbols": []
	});
});

test("Reading dependency api.json paths", async (t) => {
	const {sinon, transformApiJson} = t.context;

	const apiJsonPath = "/test-resources/sap/ui5/tooling/test/designtime/api.json";
	const fakeTargetPath = "/ignore/this/path/resource/will/be/returned";
	const dotLibraryPath = "/resources/sap/ui5/tooling/test/.library";
	const dependencyApiJsonPaths = [
		"/test-resources/sap/ui/core/designtime/api.json",
		"/test-resources/some/library/not/found/api.json" // to test the error case when reading the file
	];

	const readFile = sinon.stub().yieldsAsync(new Error("Not found!"));

	readFile.withArgs("/test-resources/sap/ui5/tooling/test/designtime/api.json").yieldsAsync(null, JSON.stringify(
		{
			"$schema-ref": "http://schemas.sap.com/sapui5/designtime/api.json/1.0",
			"version": "2.1.0",
			"library": "sap.ui5.tooling.test",
			"symbols": []
		}
	));

	readFile.withArgs("/test-resources/sap/ui/core/designtime/api.json").yieldsAsync(null, JSON.stringify(
		{
			"$schema-ref": "http://schemas.sap.com/sapui5/designtime/api.json/1.0",
			"version": "1.111.1",
			"library": "sap.ui.core",
			"symbols": []
		}
	));

	const readdir = sinon.stub().yieldsAsync(new Error("Not found!"));

	const fs = {readFile, readdir};

	const apiJsonContent = await transformApiJson(
		apiJsonPath, fakeTargetPath, dotLibraryPath, dependencyApiJsonPaths, "", {
			fs,
			returnOutputFiles: true
		}
	);

	t.deepEqual(JSON.parse(apiJsonContent), {
		"$schema-ref": "http://schemas.sap.com/sapui5/designtime/api.json/1.0",
		"version": "2.1.0",
		"library": "sap.ui5.tooling.test",
		"symbols": []
	});
});

test("Reading dependency api.json paths from directory", async (t) => {
	const {sinon, transformApiJson} = t.context;

	const apiJsonPath = "/test-resources/sap/ui5/tooling/test/designtime/api.json";
	const fakeTargetPath = "/ignore/this/path/resource/will/be/returned";
	const dotLibraryPath = "/resources/sap/ui5/tooling/test/.library";
	const dependencyApiJsonPaths = "/api-jsons";

	const readFile = sinon.stub().yieldsAsync(new Error("Not found!"));

	readFile.withArgs("/test-resources/sap/ui5/tooling/test/designtime/api.json").yieldsAsync(null, JSON.stringify(
		{
			"$schema-ref": "http://schemas.sap.com/sapui5/designtime/api.json/1.0",
			"version": "2.1.0",
			"library": "sap.ui5.tooling.test",
			"symbols": []
		}
	));

	const readdir = sinon.stub().yieldsAsync(new Error("Not found!"));

	readdir.withArgs("/api-jsons").yieldsAsync(null, ["lib1-api.json", "lib2-api.json"]);

	const fs = {readFile, readdir};

	const apiJsonContent = await transformApiJson(
		apiJsonPath, fakeTargetPath, dotLibraryPath, dependencyApiJsonPaths, "", {
			fs,
			returnOutputFiles: true
		}
	);

	t.deepEqual(JSON.parse(apiJsonContent), {
		"$schema-ref": "http://schemas.sap.com/sapui5/designtime/api.json/1.0",
		"version": "2.1.0",
		"library": "sap.ui5.tooling.test",
		"symbols": []
	});
});

test("Test with library, control, enum", async (t) => {
	const {sinon, transformApiJson} = t.context;

	const apiJsonPath = "/test-resources/sap/ui5/tooling/test/designtime/api.json";
	const fakeTargetPath = "/ignore/this/path/resource/will/be/returned";
	const dotLibraryPath = "/resources/sap/ui5/tooling/test/.library";
	const dependencyApiJsonPaths = [];

	const readFile = sinon.stub().yieldsAsync(new Error("Not found!"));

	readFile.withArgs("/resources/sap/ui5/tooling/test/.library").yieldsAsync(null, `
		<?xml version="1.0" encoding="UTF-8" ?>
		<library xmlns="http://www.sap.com/sap.ui.library.xsd" >

			<name>sap.ui5.tooling.test</name>
			<vendor>SAP SE</vendor>
			<copyright>Some copyright notice</copyright>
			<version>1.2.3</version>

			<documentation>UI5 Tooling Test Library</documentation>

		</library>`);

	readFile.withArgs("/test-resources/sap/ui5/tooling/test/designtime/api.json").yieldsAsync(null, JSON.stringify(
		{
			"$schema-ref": "http://schemas.sap.com/sapui5/designtime/api.json/1.0",
			"version": "2.1.0",
			"library": "sap.ui5.tooling.test",
			"symbols": [
				{
					"kind": "namespace",
					"name": "sap.ui5.tooling.test",
					"basename": "test",
					"resource": "sap/ui5/tooling/test/library.js",
					"module": "sap/ui5/tooling/test/library",
					"export": "",
					"static": true,
					"visibility": "public",
					"since": "1.0.0",
					"description": "UI5 Tooling Test Library",
					"deprecated": {
						"since": "2.0.0"
					}
				},
				{
					"kind": "class",
					"name": "sap.ui5.tooling.test.TestControl",
					"basename": "TestControl",
					"resource": "sap/ui5/tooling/test/TestControl.js",
					"module": "sap/ui5/tooling/test/TestControl",
					"export": "",
					"static": true,
					"visibility": "public",
					"extends": "sap.ui.core.Control",
					"description": "This control is just for UI5 Tooling testing purposes.",
					"experimental": {
						"since": "1.4",
						"text": "The API may change. Use with care."
					},
					"deprecated": {
						"since": "2.0",
						"text": "there's no replacement for this functionality"
					},
					"ui5-metadata": {
						"stereotype": "control",
						"specialSettings": [
							{
								"name": "specialControlData",
								"type": "any",
								"visibility": "public"
							}
						],
						"properties": [
							{
								"name": "value",
								"type": "string",
								"defaultValue": "",
								"group": "Misc",
								"visibility": "public",
								"description": "Property with type string",
								"deprecated": {
									"since": "2.0"
								},
								"methods": [
									"getValue",
									"setValue"
								]
							},
							{
								"name": "color",
								"type": "sap.ui5.tooling.test.TestEnum",
								"defaultValue": "Red",
								"group": "Misc",
								"visibility": "public",
								"description": "Property with an Enum",
								"methods": [
									"getColor",
									"setColor"
								]
							}
						],
						"aggregations": [
							{
								"name": "items",
								"singularName": "item",
								"type": "sap.ui.core.Control",
								"cardinality": "0..n",
								"visibility": "public",
								"description": "Items to be rendered",
								"methods": [
									"getItems",
									"destroyItems",
									"insertItem",
									"addItem",
									"removeItem",
									"indexOfItem",
									"removeAllItems"
								]
							}
						],
						"associations": [
							{
								"name": "selectedItem",
								"singularName": "selectedItem",
								"type": "sap.ui.core.Control",
								"cardinality": "0..1",
								"visibility": "public",
								"description": "Selected item",
								"methods": [
									"getSelectedItem",
									"setSelectedItem"
								]
							}
						],
						"events": [
							{
								"name": "press",
								"visibility": "public",
								"description": "Event is fired when the user clicks the control.",
								"deprecated": {
									"since": "2.0"
								},
								"methods": [
									"attachPress",
									"detachPress",
									"firePress"
								]
							},
							{
								"name": "change",
								"visibility": "public",
								"since": "1.4",
								"description": "Fires when an item is changed.",
								"parameters": {
									"item": {
										"name": "item",
										"type": "sap.ui.core.Control",
										"since": "1.4",
										"description": "Reference to the item"
									},
									"pressed": {
										"name": "pressed",
										"type": "boolean",
										"description": "Whether pressed",
										"deprecated": {}
									}
								},
								"methods": [
									"attachChange",
									"detachChange",
									"fireChange"
								]
							}
						]
					},
					"constructor": {
						"visibility": "public",
						"parameters": [
							{
								"name": "sId",
								"type": "string",
								"optional": true,
								"description": "id for the new control, generated automatically if no id is given"
							},
							{
								"name": "mSettings",
								"type": "object",
								"optional": true,
								"description": "initial settings for the new control"
							}
						],
						"throws": [
							{
								"type": "Error",
								"description": "In case something bad happens"
							}
						],
						"description": "Constructor for a new TestControl.\n\nAccepts an object literal <code>mSettings</code> that defines initial property values, aggregated and associated objects as well as event handlers. See {@link sap.ui.base.ManagedObject#constructor} for a general description of the syntax of the settings object.",
						"examples": [
							{
								"text": "new TestControl();"
							}
						]
					},
					"events": [
						{
							"name": "change",
							"visibility": "public",
							"since": "1.4",
							"parameters": [
								{
									"name": "oControlEvent",
									"type": "sap.ui.base.Event",
									"parameterProperties": {
										"getSource": {
											"name": "getSource",
											"type": "sap.ui.base.EventProvider",
											"optional": false
										},
										"getParameters": {
											"name": "getParameters",
											"type": "object",
											"optional": false,
											"parameterProperties": {
												"item": {
													"name": "item",
													"type": "sap.ui.core.Control",
													"optional": false,
													"description": "Reference to the item"
												},
												"pressed": {
													"name": "pressed",
													"type": "boolean",
													"optional": false,
													"description": "Whether pressed"
												}
											}
										}
									}
								}
							],
							"description": "Fires when an item is changed."
						},
						{
							"name": "press",
							"visibility": "public",
							"parameters": [
								{
									"name": "oControlEvent",
									"type": "sap.ui.base.Event",
									"parameterProperties": {
										"getSource": {
											"name": "getSource",
											"type": "sap.ui.base.EventProvider",
											"optional": false
										},
										"getParameters": {
											"name": "getParameters",
											"type": "object",
											"optional": false
										}
									}
								}
							],
							"description": "Event is fired when the user clicks the control.",
							"deprecated": {
								"since": "2.0"
							}
						}
					],
					"methods": [
						{
							"name": "addItem",
							"visibility": "public",
							"returnValue": {
								"type": "this",
								"description": "Reference to <code>this</code> in order to allow method chaining"
							},
							"parameters": [
								{
									"name": "oItem",
									"type": "sap.ui.core.Control",
									"optional": false,
									"description": "The item to add; if empty, nothing is inserted"
								}
							],
							"description": "Adds some item to the aggregation {@link #getItems items}."
						},
						{
							"name": "attachChange",
							"visibility": "public",
							"since": "1.4",
							"returnValue": {
								"type": "this",
								"description": "Reference to <code>this</code> in order to allow method chaining"
							},
							"parameters": [
								{
									"name": "oData",
									"type": "object",
									"optional": true,
									"description": "An application-specific payload object that will be passed to the event handler along with the event object when firing the event"
								},
								{
									"name": "fnFunction",
									"type": "function(sap.ui.base.Event) : void",
									"optional": false,
									"description": "The function to be called when the event occurs"
								},
								{
									"name": "oListener",
									"type": "object",
									"optional": true,
									"description": "Context object to call the event handler with. Defaults to this <code>sap.ui5.tooling.test.TestControl</code> itself"
								}
							],
							"description": "Attaches event handler <code>fnFunction</code> to the {@link #event:change change} event of this <code>sap.ui5.tooling.test.TestControl</code>.\n\nWhen called, the context of the event handler (its <code>this</code>) will be bound to <code>oListener</code> if specified, otherwise it will be bound to this <code>sap.ui5.tooling.test.TestControl</code> itself.\n\nFires when an item is changed."
						},
						{
							"name": "attachPress",
							"visibility": "public",
							"returnValue": {
								"type": "this",
								"description": "Reference to <code>this</code> in order to allow method chaining"
							},
							"parameters": [
								{
									"name": "oData",
									"type": "object",
									"optional": true,
									"description": "An application-specific payload object that will be passed to the event handler along with the event object when firing the event"
								},
								{
									"name": "fnFunction",
									"type": "function(sap.ui.base.Event) : void",
									"optional": false,
									"description": "The function to be called when the event occurs"
								},
								{
									"name": "oListener",
									"type": "object",
									"optional": true,
									"description": "Context object to call the event handler with. Defaults to this <code>sap.ui5.tooling.test.TestControl</code> itself"
								}
							],
							"description": "Attaches event handler <code>fnFunction</code> to the {@link #event:press press} event of this <code>sap.ui5.tooling.test.TestControl</code>.\n\nWhen called, the context of the event handler (its <code>this</code>) will be bound to <code>oListener</code> if specified, otherwise it will be bound to this <code>sap.ui5.tooling.test.TestControl</code> itself.\n\nEvent is fired when the user clicks the control.",
							"deprecated": {
								"since": "2.0"
							}
						},
						{
							"name": "destroyItems",
							"visibility": "public",
							"returnValue": {
								"type": "this",
								"description": "Reference to <code>this</code> in order to allow method chaining"
							},
							"description": "Destroys all the items in the aggregation {@link #getItems items}."
						},
						{
							"name": "detachChange",
							"visibility": "public",
							"since": "1.4",
							"returnValue": {
								"type": "this",
								"description": "Reference to <code>this</code> in order to allow method chaining"
							},
							"parameters": [
								{
									"name": "fnFunction",
									"type": "function(sap.ui.base.Event) : void",
									"optional": false,
									"description": "The function to be called, when the event occurs"
								},
								{
									"name": "oListener",
									"type": "object",
									"optional": true,
									"description": "Context object on which the given function had to be called"
								}
							],
							"description": "Detaches event handler <code>fnFunction</code> from the {@link #event:change change} event of this <code>sap.ui5.tooling.test.TestControl</code>.\n\nThe passed function and listener object must match the ones used for event registration."
						},
						{
							"name": "detachPress",
							"visibility": "public",
							"returnValue": {
								"type": "this",
								"description": "Reference to <code>this</code> in order to allow method chaining"
							},
							"parameters": [
								{
									"name": "fnFunction",
									"type": "function(sap.ui.base.Event) : void",
									"optional": false,
									"description": "The function to be called, when the event occurs"
								},
								{
									"name": "oListener",
									"type": "object",
									"optional": true,
									"description": "Context object on which the given function had to be called"
								}
							],
							"description": "Detaches event handler <code>fnFunction</code> from the {@link #event:press press} event of this <code>sap.ui5.tooling.test.TestControl</code>.\n\nThe passed function and listener object must match the ones used for event registration.",
							"deprecated": {
								"since": "2.0"
							}
						},
						{
							"name": "extend",
							"visibility": "public",
							"static": true,
							"returnValue": {
								"type": "function",
								"description": "Created class / constructor function"
							},
							"parameters": [
								{
									"name": "sClassName",
									"type": "string",
									"optional": false,
									"description": "Name of the class being created"
								},
								{
									"name": "oClassInfo",
									"type": "object",
									"optional": true,
									"description": "Object literal with information about the class"
								},
								{
									"name": "FNMetaImpl",
									"type": "function",
									"optional": true,
									"description": "Constructor function for the metadata object; if not given, it defaults to the metadata implementation used by this class"
								}
							],
							"description": "Creates a new subclass of class sap.ui5.tooling.test.TestControl with name <code>sClassName</code> and enriches it with the information contained in <code>oClassInfo</code>.\n\n<code>oClassInfo</code> might contain the same kind of information as described in {@link sap.ui.core.Control.extend}."
						},
						{
							"name": "fancyFunction",
							"visibility": "public",
							"throws": [
								{
									"type": "Error",
									"description": "In case something bad happens"
								}
							],
							"description": "Some fancy function.\n\nSome links: {@link https://openui5.org OpenUI5} {@link demo:foo} {@link sap.ui.core.Control.prototype.placeAt} {@link sap.m.Button#event:press} {@link sap.m.Button#setText} {@link fiori:/flexible-column-layout/ Flexible Column Layout} {@link topic:59a0e11712e84a648bb990a1dba76bc7 Link text} {@link module:sap/ui/comp/smartfield/SmartField#annotation:TextArrangement TextArrangement}",
							"deprecated": {
								"since": "2.0"
							}
						},
						{
							"name": "fireChange",
							"visibility": "protected",
							"since": "1.4",
							"returnValue": {
								"type": "this",
								"description": "Reference to <code>this</code> in order to allow method chaining"
							},
							"parameters": [
								{
									"name": "mParameters",
									"type": "object",
									"optional": true,
									"parameterProperties": {
										"item": {
											"name": "item",
											"type": "sap.ui.core.Control",
											"optional": true,
											"description": "Reference to the item"
										},
										"pressed": {
											"name": "pressed",
											"type": "boolean",
											"optional": true,
											"description": "Whether pressed"
										}
									},
									"description": "Parameters to pass along with the event"
								}
							],
							"description": "Fires event {@link #event:change change} to attached listeners."
						},
						{
							"name": "firePress",
							"visibility": "protected",
							"returnValue": {
								"type": "this",
								"description": "Reference to <code>this</code> in order to allow method chaining"
							},
							"parameters": [
								{
									"name": "mParameters",
									"type": "object",
									"optional": true,
									"description": "Parameters to pass along with the event"
								}
							],
							"description": "Fires event {@link #event:press press} to attached listeners.",
							"deprecated": {
								"since": "2.0"
							}
						},
						{
							"name": "getColor",
							"visibility": "public",
							"returnValue": {
								"type": "sap.ui5.tooling.test.TestEnum",
								"description": "Value of property <code>color</code>"
							},
							"description": "Gets current value of property {@link #getColor color}.\n\nProperty with an Enum\n\nDefault value is <code>Red</code>."
						},
						{
							"name": "getItems",
							"visibility": "public",
							"returnValue": {
								"type": "sap.ui.core.Control[]"
							},
							"description": "Gets content of aggregation {@link #getItems items}.\n\nItems to be rendered"
						},
						{
							"name": "getMetadata",
							"visibility": "public",
							"static": true,
							"returnValue": {
								"type": "sap.ui.core.ElementMetadata",
								"description": "Metadata object describing this class"
							},
							"description": "Returns a metadata object for class sap.ui5.tooling.test.TestControl."
						},
						{
							"name": "getSelectedItem",
							"visibility": "public",
							"returnValue": {
								"type": "sap.ui.core.ID"
							},
							"description": "ID of the element which is the current target of the association {@link #getSelectedItem selectedItem}, or <code>null</code>."
						},
						{
							"name": "getValue",
							"visibility": "public",
							"returnValue": {
								"type": "string",
								"description": "Value of property <code>value</code>"
							},
							"description": "Gets current value of property {@link #getValue value}.\n\nProperty with type string\n\nDefault value is <code>empty string</code>.",
							"deprecated": {
								"since": "2.0"
							}
						},
						{
							"name": "indexOfItem",
							"visibility": "public",
							"returnValue": {
								"type": "int",
								"description": "The index of the provided control in the aggregation if found, or -1 otherwise"
							},
							"parameters": [
								{
									"name": "oItem",
									"type": "sap.ui.core.Control",
									"optional": false,
									"description": "The item whose index is looked for"
								}
							],
							"description": "Checks for the provided <code>sap.ui.core.Control</code> in the aggregation {@link #getItems items}. and returns its index if found or -1 otherwise."
						},
						{
							"name": "insertItem",
							"visibility": "public",
							"returnValue": {
								"type": "this",
								"description": "Reference to <code>this</code> in order to allow method chaining"
							},
							"parameters": [
								{
									"name": "oItem",
									"type": "sap.ui.core.Control",
									"optional": false,
									"description": "The item to insert; if empty, nothing is inserted"
								},
								{
									"name": "iIndex",
									"type": "int",
									"optional": false,
									"description": "The <code>0</code>-based index the item should be inserted at; for a negative value of <code>iIndex</code>, the item is inserted at position 0; for a value greater than the current size of the aggregation, the item is inserted at the last position"
								}
							],
							"description": "Inserts a item into the aggregation {@link #getItems items}."
						},
						{
							"name": "removeAllItems",
							"visibility": "public",
							"returnValue": {
								"type": "sap.ui.core.Control[]",
								"description": "An array of the removed elements (might be empty)"
							},
							"description": "Removes all the controls from the aggregation {@link #getItems items}.\n\nAdditionally, it unregisters them from the hosting UIArea."
						},
						{
							"name": "removeItem",
							"visibility": "public",
							"returnValue": {
								"type": "sap.ui.core.Control|null",
								"description": "The removed item or <code>null</code>"
							},
							"parameters": [
								{
									"name": "vItem",
									"type": "int|string|sap.ui.core.Control",
									"optional": false,
									"description": "The item to remove or its index or id"
								}
							],
							"description": "Removes a item from the aggregation {@link #getItems items}."
						},
						{
							"name": "setColor",
							"visibility": "public",
							"returnValue": {
								"type": "this",
								"description": "Reference to <code>this</code> in order to allow method chaining"
							},
							"parameters": [
								{
									"name": "sColor",
									"type": "sap.ui5.tooling.test.TestEnum",
									"optional": true,
									"defaultValue": "Red",
									"description": "New value for property <code>color</code>"
								}
							],
							"description": "Sets a new value for property {@link #getColor color}.\n\nProperty with an Enum\n\nWhen called with a value of <code>null</code> or <code>undefined</code>, the default value of the property will be restored.\n\nDefault value is <code>Red</code>."
						},
						{
							"name": "setSelectedItem",
							"visibility": "public",
							"returnValue": {
								"type": "this",
								"description": "Reference to <code>this</code> in order to allow method chaining"
							},
							"parameters": [
								{
									"name": "oSelectedItem",
									"type": "sap.ui.core.ID|sap.ui.core.Control",
									"optional": false,
									"description": "ID of an element which becomes the new target of this selectedItem association; alternatively, an element instance may be given"
								}
							],
							"description": "Sets the associated {@link #getSelectedItem selectedItem}."
						},
						{
							"name": "setValue",
							"visibility": "public",
							"returnValue": {
								"type": "this",
								"description": "Reference to <code>this</code> in order to allow method chaining"
							},
							"parameters": [
								{
									"name": "sValue",
									"type": "string",
									"optional": true,
									"defaultValue": "\"\"",
									"description": "New value for property <code>value</code>"
								}
							],
							"description": "Sets a new value for property {@link #getValue value}.\n\nProperty with type string\n\nWhen called with a value of <code>null</code> or <code>undefined</code>, the default value of the property will be restored.\n\nDefault value is <code>empty string</code>.",
							"deprecated": {
								"since": "2.0"
							}
						}
					]
				},
				{
					"kind": "enum",
					"name": "sap.ui5.tooling.test.TestEnum",
					"basename": "TestEnum",
					"resource": "sap/ui5/tooling/test/library.js",
					"module": "sap/ui5/tooling/test/library",
					"export": "TestEnum",
					"static": true,
					"visibility": "public",
					"description": "Defines colors",
					"ui5-metadata": {
						"stereotype": "enum"
					},
					"properties": [
						{
							"name": "Blue",
							"visibility": "public",
							"static": true,
							"type": "string",
							"description": "Yellow"
						},
						{
							"name": "Red",
							"visibility": "public",
							"static": true,
							"type": "string",
							"description": "Red"
						}
					]
				}
			]
		}
	));

	const readdir = sinon.stub().yieldsAsync(new Error("Not found!"));

	const fs = {readFile, readdir};

	const apiJsonContent = await transformApiJson(
		apiJsonPath, fakeTargetPath, dotLibraryPath, dependencyApiJsonPaths, "", {
			fs,
			returnOutputFiles: true
		}
	);

	t.deepEqual(JSON.parse(apiJsonContent),
		{
			"$schema-ref": "http://schemas.sap.com/sapui5/designtime/api.json/1.0",
			"version": "2.1.0",
			"library": "sap.ui5.tooling.test",
			"symbols": [
				{
					"kind": "namespace",
					"name": "sap.ui5.tooling.test",
					"basename": "test",
					"resource": "sap/ui5/tooling/test/library.js",
					"module": "sap/ui5/tooling/test/library",
					"export": "",
					"static": true,
					"visibility": "public",
					"since": "1.0.0",
					"description": "<p><p>UI5 Tooling Test Library</p></p>",
					"displayName": "sap.ui5.tooling.test",
					"nodes": [
						{
							"name": "sap.ui5.tooling.test.TestControl",
							"description": "<p>This control is just for UI5 Tooling testing purposes.</p>",
							"href": "api/sap.ui5.tooling.test.TestControl",
							"deprecated": true
						},
						{
							"name": "sap.ui5.tooling.test.TestEnum",
							"description": "<p>Defines colors</p>",
							"href": "api/sap.ui5.tooling.test.TestEnum"
						}
					],
					"title": "namespace sap.ui5.tooling.test",
					"subTitle": "Deprecated in version: 2.0.0",
					"deprecatedText": "Deprecated as of version 2.0.0"
				},
				{
					"kind": "class",
					"name": "sap.ui5.tooling.test.TestControl",
					"basename": "TestControl",
					"resource": "sap/ui5/tooling/test/TestControl.js",
					"module": "sap/ui5/tooling/test/TestControl",
					"export": "",
					"static": true,
					"visibility": "public",
					"extends": "sap.ui.core.Control",
					"description": "<p>This control is just for UI5 Tooling testing purposes.</p>",
					"experimental": {
						"since": "1.4",
						"text": "The API may change. Use with care."
					},
					"ui5-metadata": {
						"stereotype": "control",
						"specialSettings": [
							{
								"name": "specialControlData",
								"type": "any",
								"visibility": "public",
								"description": ""
							}
						],
						"properties": [
							{
								"name": "color",
								"type": "sap.ui5.tooling.test.TestEnum",
								"defaultValue": "Red",
								"group": "Misc",
								"visibility": "public",
								"description": "<p>Property with an Enum</p>",
								"methods": [
									"getColor",
									"setColor"
								],
								"linkEnabled": true
							},
							{
								"name": "value",
								"type": "string",
								"defaultValue": "empty string",
								"group": "Misc",
								"visibility": "public",
								"description": "<p>Property with type string</p>",
								"methods": [
									"getValue",
									"setValue"
								],
								"deprecatedText": "Deprecated as of version 2.0"
							}
						],
						"aggregations": [
							{
								"name": "items",
								"singularName": "item",
								"type": "sap.ui.core.Control",
								"cardinality": "0..n",
								"visibility": "public",
								"description": "<p>Items to be rendered</p>",
								"methods": [
									"getItems",
									"destroyItems",
									"insertItem",
									"addItem",
									"removeItem",
									"indexOfItem",
									"removeAllItems"
								],
								"linkEnabled": true
							}
						],
						"associations": [
							{
								"name": "selectedItem",
								"singularName": "selectedItem",
								"type": "sap.ui.core.Control",
								"cardinality": "0..1",
								"visibility": "public",
								"description": "<p>Selected item</p>",
								"methods": [
									"getSelectedItem",
									"setSelectedItem"
								],
								"linkEnabled": true
							}
						]
					},
					"constructor": {
						"visibility": "public",
						"parameters": [
							{
								"name": "sId",
								"optional": true,
								"description": "<p>id for the new control, generated automatically if no id is given</p>",
								"phoneName": "sId",
								"depth": 0,
								"types": [
									{
										"name": "string",
										"linkEnabled": false
									}
								],
								"defaultValue": ""
							},
							{
								"name": "mSettings",
								"optional": true,
								"description": "<p>initial settings for the new control</p>",
								"phoneName": "mSettings",
								"depth": 0,
								"types": [
									{
										"name": "object",
										"linkEnabled": false
									}
								],
								"defaultValue": ""
							}
						],
						"throws": [
							{
								"type": "Error",
								"description": "<p>In case something bad happens</p>",
								"linkEnabled": false
							}
						],
						"description": "<p>Constructor for a new TestControl.</p><p>Accepts an object literal <code>mSettings</code> that defines initial property values, aggregated and associated objects as well as event handlers. See <a target=\"_self\" href=\"api/sap.ui.base.ManagedObject#constructor\">sap.ui.base.ManagedObject#constructor</a> for a general description of the syntax of the settings object.</p>",
						"examples": [
							{
								"data": "<p><span><strong>Example: </strong><pre class='sapUiSmallMarginTop'>new TestControl();</pre></span></p>"
							}
						],
						"references": [],
						"codeExample": "<pre>new sap.ui5.tooling.test.TestControl(sId?, mSettings?)</pre>"
					},
					"events": [
						{
							"name": "change",
							"visibility": "public",
							"since": "1.4",
							"parameters": [
								{
									"name": "oControlEvent",
									"type": "sap.ui.base.Event",
									"linkEnabled": true
								},
								{
									"name": "getSource",
									"type": "sap.ui.base.EventProvider",
									"optional": false,
									"depth": 1,
									"phoneName": "oControlEvent.getSource",
									"linkEnabled": true
								},
								{
									"name": "getParameters",
									"type": "object",
									"optional": false,
									"depth": 1,
									"phoneName": "oControlEvent.getParameters"
								},
								{
									"name": "item",
									"type": "sap.ui.core.Control",
									"optional": false,
									"description": "<p>Reference to the item<br><br><i>Since: 1.4.</i></p>",
									"since": "1.4",
									"depth": 2,
									"phoneName": "oControlEvent.getParameters.item",
									"linkEnabled": true
								},
								{
									"name": "pressed",
									"type": "boolean",
									"optional": false,
									"description": "<p>Whether pressed</p>",
									"deprecated": {},
									"depth": 2,
									"phoneName": "oControlEvent.getParameters.pressed",
									"deprecatedText": "Deprecated"
								}
							],
							"description": "<p>Fires when an item is changed.<br><br><i>Since: 1.4.</i></p>"
						},
						{
							"name": "press",
							"visibility": "public",
							"parameters": [
								{
									"name": "oControlEvent",
									"type": "sap.ui.base.Event",
									"linkEnabled": true
								},
								{
									"name": "getSource",
									"type": "sap.ui.base.EventProvider",
									"optional": false,
									"depth": 1,
									"phoneName": "oControlEvent.getSource",
									"linkEnabled": true
								},
								{
									"name": "getParameters",
									"type": "object",
									"optional": false,
									"depth": 1,
									"phoneName": "oControlEvent.getParameters"
								}
							],
							"description": "<p>Event is fired when the user clicks the control.</p>",
							"deprecated": {
								"since": "2.0"
							},
							"deprecatedText": "Deprecated as of version 2.0"
						}
					],
					"methods": [
						{
							"name": "addItem",
							"visibility": "public",
							"returnValue": {
								"type": "this",
								"description": "<p>Reference to <code>this</code> in order to allow method chaining</p>",
								"types": [
									{
										"value": "this"
									}
								]
							},
							"parameters": [
								{
									"name": "oItem",
									"optional": false,
									"description": "<p>The item to add; if empty, nothing is inserted</p>",
									"types": [
										{
											"value": "sap.ui.core.Control",
											"linkEnabled": true,
											"href": "api/sap.ui.core.Control"
										}
									],
									"defaultValue": ""
								}
							],
							"description": "<p>Adds some item to the aggregation <a target=\"_self\" href=\"api/sap.ui5.tooling.test.TestControl#methods/getItems\">items</a>.</p>",
							"href": "api/sap.ui5.tooling.test.TestControl#methods/addItem",
							"code": "<pre>addItem(oItem) : this</pre>"
						},
						{
							"name": "attachChange",
							"visibility": "public",
							"since": "1.4",
							"returnValue": {
								"type": "this",
								"description": "<p>Reference to <code>this</code> in order to allow method chaining</p>",
								"types": [
									{
										"value": "this"
									}
								]
							},
							"parameters": [
								{
									"name": "oData",
									"optional": true,
									"description": "<p>An application-specific payload object that will be passed to the event handler along with the event object when firing the event</p>",
									"types": [
										{
											"value": "object"
										}
									],
									"defaultValue": ""
								},
								{
									"name": "fnFunction",
									"optional": false,
									"description": "<p>The function to be called when the event occurs</p>",
									"types": [
										{
											"value": "function(sap.ui.base.Event) : void"
										}
									],
									"defaultValue": ""
								},
								{
									"name": "oListener",
									"optional": true,
									"description": "<p>Context object to call the event handler with. Defaults to this <code>sap.ui5.tooling.test.TestControl</code> itself</p>",
									"types": [
										{
											"value": "object"
										}
									],
									"defaultValue": ""
								}
							],
							"description": "<p>Attaches event handler <code>fnFunction</code> to the <a target=\"_self\" href=\"api/sap.ui5.tooling.test.TestControl#events/change\">change</a> event of this <code>sap.ui5.tooling.test.TestControl</code>.</p><p>When called, the context of the event handler (its <code>this</code>) will be bound to <code>oListener</code> if specified, otherwise it will be bound to this <code>sap.ui5.tooling.test.TestControl</code> itself.</p><p>Fires when an item is changed.</p>",
							"href": "api/sap.ui5.tooling.test.TestControl#methods/attachChange",
							"code": "<pre>attachChange(oData?, fnFunction, oListener?) : this</pre>"
						},
						{
							"name": "attachPress",
							"visibility": "public",
							"returnValue": {
								"type": "this",
								"description": "<p>Reference to <code>this</code> in order to allow method chaining</p>",
								"types": [
									{
										"value": "this"
									}
								]
							},
							"parameters": [
								{
									"name": "oData",
									"optional": true,
									"description": "<p>An application-specific payload object that will be passed to the event handler along with the event object when firing the event</p>",
									"types": [
										{
											"value": "object"
										}
									],
									"defaultValue": ""
								},
								{
									"name": "fnFunction",
									"optional": false,
									"description": "<p>The function to be called when the event occurs</p>",
									"types": [
										{
											"value": "function(sap.ui.base.Event) : void"
										}
									],
									"defaultValue": ""
								},
								{
									"name": "oListener",
									"optional": true,
									"description": "<p>Context object to call the event handler with. Defaults to this <code>sap.ui5.tooling.test.TestControl</code> itself</p>",
									"types": [
										{
											"value": "object"
										}
									],
									"defaultValue": ""
								}
							],
							"description": "<p>Attaches event handler <code>fnFunction</code> to the <a target=\"_self\" href=\"api/sap.ui5.tooling.test.TestControl#events/press\">press</a> event of this <code>sap.ui5.tooling.test.TestControl</code>.</p><p>When called, the context of the event handler (its <code>this</code>) will be bound to <code>oListener</code> if specified, otherwise it will be bound to this <code>sap.ui5.tooling.test.TestControl</code> itself.</p><p>Event is fired when the user clicks the control.</p>",
							"deprecated": {
								"since": "2.0"
							},
							"href": "api/sap.ui5.tooling.test.TestControl#methods/attachPress",
							"deprecatedText": "Deprecated as of version 2.0",
							"code": "<pre>attachPress(oData?, fnFunction, oListener?) : this</pre>"
						},
						{
							"name": "destroyItems",
							"visibility": "public",
							"returnValue": {
								"type": "this",
								"description": "<p>Reference to <code>this</code> in order to allow method chaining</p>",
								"types": [
									{
										"value": "this"
									}
								]
							},
							"description": "<p>Destroys all the items in the aggregation <a target=\"_self\" href=\"api/sap.ui5.tooling.test.TestControl#methods/getItems\">items</a>.</p>",
							"href": "api/sap.ui5.tooling.test.TestControl#methods/destroyItems",
							"code": "<pre>destroyItems() : this</pre>"
						},
						{
							"name": "detachChange",
							"visibility": "public",
							"since": "1.4",
							"returnValue": {
								"type": "this",
								"description": "<p>Reference to <code>this</code> in order to allow method chaining</p>",
								"types": [
									{
										"value": "this"
									}
								]
							},
							"parameters": [
								{
									"name": "fnFunction",
									"optional": false,
									"description": "<p>The function to be called, when the event occurs</p>",
									"types": [
										{
											"value": "function(sap.ui.base.Event) : void"
										}
									],
									"defaultValue": ""
								},
								{
									"name": "oListener",
									"optional": true,
									"description": "<p>Context object on which the given function had to be called</p>",
									"types": [
										{
											"value": "object"
										}
									],
									"defaultValue": ""
								}
							],
							"description": "<p>Detaches event handler <code>fnFunction</code> from the <a target=\"_self\" href=\"api/sap.ui5.tooling.test.TestControl#events/change\">change</a> event of this <code>sap.ui5.tooling.test.TestControl</code>.</p><p>The passed function and listener object must match the ones used for event registration.</p>",
							"href": "api/sap.ui5.tooling.test.TestControl#methods/detachChange",
							"code": "<pre>detachChange(fnFunction, oListener?) : this</pre>"
						},
						{
							"name": "detachPress",
							"visibility": "public",
							"returnValue": {
								"type": "this",
								"description": "<p>Reference to <code>this</code> in order to allow method chaining</p>",
								"types": [
									{
										"value": "this"
									}
								]
							},
							"parameters": [
								{
									"name": "fnFunction",
									"optional": false,
									"description": "<p>The function to be called, when the event occurs</p>",
									"types": [
										{
											"value": "function(sap.ui.base.Event) : void"
										}
									],
									"defaultValue": ""
								},
								{
									"name": "oListener",
									"optional": true,
									"description": "<p>Context object on which the given function had to be called</p>",
									"types": [
										{
											"value": "object"
										}
									],
									"defaultValue": ""
								}
							],
							"description": "<p>Detaches event handler <code>fnFunction</code> from the <a target=\"_self\" href=\"api/sap.ui5.tooling.test.TestControl#events/press\">press</a> event of this <code>sap.ui5.tooling.test.TestControl</code>.</p><p>The passed function and listener object must match the ones used for event registration.</p>",
							"deprecated": {
								"since": "2.0"
							},
							"href": "api/sap.ui5.tooling.test.TestControl#methods/detachPress",
							"deprecatedText": "Deprecated as of version 2.0",
							"code": "<pre>detachPress(fnFunction, oListener?) : this</pre>"
						},
						{
							"name": "sap.ui5.tooling.test.TestControl.extend",
							"visibility": "public",
							"static": true,
							"returnValue": {
								"type": "function",
								"description": "<p>Created class / constructor function</p>",
								"types": [
									{
										"value": "function"
									}
								]
							},
							"parameters": [
								{
									"name": "sClassName",
									"optional": false,
									"description": "<p>Name of the class being created</p>",
									"types": [
										{
											"value": "string"
										}
									],
									"defaultValue": ""
								},
								{
									"name": "oClassInfo",
									"optional": true,
									"description": "<p>Object literal with information about the class</p>",
									"types": [
										{
											"value": "object"
										}
									],
									"defaultValue": ""
								},
								{
									"name": "FNMetaImpl",
									"optional": true,
									"description": "<p>Constructor function for the metadata object; if not given, it defaults to the metadata implementation used by this class</p>",
									"types": [
										{
											"value": "function"
										}
									],
									"defaultValue": ""
								}
							],
							"description": "<p>Creates a new subclass of class sap.ui5.tooling.test.TestControl with name <code>sClassName</code> and enriches it with the information contained in <code>oClassInfo</code>.</p><p><code>oClassInfo</code> might contain the same kind of information as described in <a target=\"_self\" href=\"api/sap.ui.core.Control#methods/sap.ui.core.Control.extend\">sap.ui.core.Control.extend</a>.</p>",
							"href": "api/sap.ui5.tooling.test.TestControl#methods/sap.ui5.tooling.test.TestControl.extend",
							"code": "<pre>sap.ui5.tooling.test.TestControl.extend(sClassName, oClassInfo?, FNMetaImpl?) : function</pre>"
						},
						{
							"name": "fancyFunction",
							"visibility": "public",
							"throws": [
								{
									"type": "Error",
									"description": "<p>In case something bad happens</p>",
									"linkEnabled": false
								}
							],
							"description": "<p>Some fancy function.</p><p>Some links: <a target=\"_blank\" rel=\"noopener noreferrer\" href=\"https://openui5.org\">OpenUI5</a>\n\t\t\t<img src=\"./resources/sap/ui/documentation/sdk/images/link-external.png\"\n\t\t\ttitle=\"Information published on non SAP site\" class=\"sapUISDKExternalLink\"/> <a target=\"_blank\" rel=\"noopener noreferrer\" href=\"test-resources/foo\">demo:foo</a>\n\t\t\t<img src=\"./resources/sap/ui/documentation/sdk/images/link-sap.png\"\n\t\t\ttitle=\"Information published on SAP site\" class=\"sapUISDKExternalLink\"/> <a target=\"_self\" href=\"api/sap.ui.core.Control#methods/placeAt\">sap.ui.core.Control.prototype.placeAt</a> <a target=\"_self\" href=\"api/sap.m.Button#events/press\">sap.m.Button#event:press</a> <a target=\"_self\" href=\"api/sap.m.Button#methods/setText\">sap.m.Button#setText</a> <a target=\"_self\" href=\"api/fiori:/flexible-column-layout/\">Flexible Column Layout</a> <a target=\"_self\" href=\"topic/59a0e11712e84a648bb990a1dba76bc7\">Link text</a> <a target=\"_self\" href=\"api/module:sap/ui/comp/smartfield/SmartField#annotations/TextArrangement\">TextArrangement</a></p>",
							"deprecated": {
								"since": "2.0"
							},
							"href": "api/sap.ui5.tooling.test.TestControl#methods/fancyFunction",
							"deprecatedText": "Deprecated as of version 2.0",
							"code": "<pre>fancyFunction() : void</pre>"
						},
						{
							"name": "fireChange",
							"visibility": "protected",
							"since": "1.4",
							"returnValue": {
								"type": "this",
								"description": "<p>Reference to <code>this</code> in order to allow method chaining</p>",
								"types": [
									{
										"value": "this"
									}
								]
							},
							"parameters": [
								{
									"name": "mParameters",
									"optional": true,
									"description": "<p>Parameters to pass along with the event</p>",
									"types": [
										{
											"value": "object"
										}
									],
									"defaultValue": ""
								},
								{
									"name": "item",
									"optional": true,
									"description": "<p>Reference to the item</p>",
									"depth": 1,
									"types": [
										{
											"value": "sap.ui.core.Control",
											"linkEnabled": true,
											"href": "api/sap.ui.core.Control"
										}
									],
									"phoneName": "mParameters.item",
									"defaultValue": ""
								},
								{
									"name": "pressed",
									"optional": true,
									"description": "<p>Whether pressed</p>",
									"depth": 1,
									"types": [
										{
											"value": "boolean"
										}
									],
									"phoneName": "mParameters.pressed",
									"defaultValue": ""
								}
							],
							"description": "<p>Fires event <a target=\"_self\" href=\"api/sap.ui5.tooling.test.TestControl#events/change\">change</a> to attached listeners.</p>",
							"href": "api/sap.ui5.tooling.test.TestControl#methods/fireChange",
							"code": "<pre>fireChange(mParameters?) : this</pre>"
						},
						{
							"name": "firePress",
							"visibility": "protected",
							"returnValue": {
								"type": "this",
								"description": "<p>Reference to <code>this</code> in order to allow method chaining</p>",
								"types": [
									{
										"value": "this"
									}
								]
							},
							"parameters": [
								{
									"name": "mParameters",
									"optional": true,
									"description": "<p>Parameters to pass along with the event</p>",
									"types": [
										{
											"value": "object"
										}
									],
									"defaultValue": ""
								}
							],
							"description": "<p>Fires event <a target=\"_self\" href=\"api/sap.ui5.tooling.test.TestControl#events/press\">press</a> to attached listeners.</p>",
							"deprecated": {
								"since": "2.0"
							},
							"href": "api/sap.ui5.tooling.test.TestControl#methods/firePress",
							"deprecatedText": "Deprecated as of version 2.0",
							"code": "<pre>firePress(mParameters?) : this</pre>"
						},
						{
							"name": "getColor",
							"visibility": "public",
							"returnValue": {
								"type": "sap.ui5.tooling.test.TestEnum",
								"description": "<p>Value of property <code>color</code></p>",
								"types": [
									{
										"value": "sap.ui5.tooling.test.TestEnum"
									}
								]
							},
							"description": "<p>Gets current value of property <a target=\"_self\" href=\"api/sap.ui5.tooling.test.TestControl#methods/getColor\">color</a>.</p><p>Property with an Enum</p><p>Default value is <code>Red</code>.</p>",
							"href": "api/sap.ui5.tooling.test.TestControl#methods/getColor",
							"code": "<pre>getColor() : sap.ui5.tooling.test.TestEnum</pre>"
						},
						{
							"name": "getItems",
							"visibility": "public",
							"returnValue": {
								"type": "sap.ui.core.Control[]",
								"types": [
									{
										"value": "sap.ui.core.Control[]"
									}
								],
								"description": ""
							},
							"description": "<p>Gets content of aggregation <a target=\"_self\" href=\"api/sap.ui5.tooling.test.TestControl#methods/getItems\">items</a>.</p><p>Items to be rendered</p>",
							"href": "api/sap.ui5.tooling.test.TestControl#methods/getItems",
							"code": "<pre>getItems() : sap.ui.core.Control[]</pre>"
						},
						{
							"name": "sap.ui5.tooling.test.TestControl.getMetadata",
							"visibility": "public",
							"static": true,
							"returnValue": {
								"type": "sap.ui.core.ElementMetadata",
								"description": "<p>Metadata object describing this class</p>",
								"types": [
									{
										"value": "sap.ui.core.ElementMetadata",
										"href": "api/sap.ui.core.ElementMetadata",
										"linkEnabled": true
									}
								]
							},
							"description": "<p>Returns a metadata object for class sap.ui5.tooling.test.TestControl.</p>",
							"href": "api/sap.ui5.tooling.test.TestControl#methods/sap.ui5.tooling.test.TestControl.getMetadata",
							"code": "<pre>sap.ui5.tooling.test.TestControl.getMetadata() : sap.ui.core.ElementMetadata</pre>"
						},
						{
							"name": "getSelectedItem",
							"visibility": "public",
							"returnValue": {
								"type": "sap.ui.core.ID",
								"types": [
									{
										"value": "sap.ui.core.ID",
										"href": "api/sap.ui.core.ID",
										"linkEnabled": true
									}
								],
								"description": ""
							},
							"description": "<p>ID of the element which is the current target of the association <a target=\"_self\" href=\"api/sap.ui5.tooling.test.TestControl#methods/getSelectedItem\">selectedItem</a>, or <code>null</code>.</p>",
							"href": "api/sap.ui5.tooling.test.TestControl#methods/getSelectedItem",
							"code": "<pre>getSelectedItem() : sap.ui.core.ID</pre>"
						},
						{
							"name": "getValue",
							"visibility": "public",
							"returnValue": {
								"type": "string",
								"description": "<p>Value of property <code>value</code></p>",
								"types": [
									{
										"value": "string"
									}
								]
							},
							"description": "<p>Gets current value of property <a target=\"_self\" href=\"api/sap.ui5.tooling.test.TestControl#methods/getValue\">value</a>.</p><p>Property with type string</p><p>Default value is <code>empty string</code>.</p>",
							"deprecated": {
								"since": "2.0"
							},
							"href": "api/sap.ui5.tooling.test.TestControl#methods/getValue",
							"deprecatedText": "Deprecated as of version 2.0",
							"code": "<pre>getValue() : string</pre>"
						},
						{
							"name": "indexOfItem",
							"visibility": "public",
							"returnValue": {
								"type": "int",
								"description": "<p>The index of the provided control in the aggregation if found, or -1 otherwise</p>",
								"types": [
									{
										"value": "int"
									}
								]
							},
							"parameters": [
								{
									"name": "oItem",
									"optional": false,
									"description": "<p>The item whose index is looked for</p>",
									"types": [
										{
											"value": "sap.ui.core.Control",
											"linkEnabled": true,
											"href": "api/sap.ui.core.Control"
										}
									],
									"defaultValue": ""
								}
							],
							"description": "<p>Checks for the provided <code>sap.ui.core.Control</code> in the aggregation <a target=\"_self\" href=\"api/sap.ui5.tooling.test.TestControl#methods/getItems\">items</a>. and returns its index if found or -1 otherwise.</p>",
							"href": "api/sap.ui5.tooling.test.TestControl#methods/indexOfItem",
							"code": "<pre>indexOfItem(oItem) : int</pre>"
						},
						{
							"name": "insertItem",
							"visibility": "public",
							"returnValue": {
								"type": "this",
								"description": "<p>Reference to <code>this</code> in order to allow method chaining</p>",
								"types": [
									{
										"value": "this"
									}
								]
							},
							"parameters": [
								{
									"name": "oItem",
									"optional": false,
									"description": "<p>The item to insert; if empty, nothing is inserted</p>",
									"types": [
										{
											"value": "sap.ui.core.Control",
											"linkEnabled": true,
											"href": "api/sap.ui.core.Control"
										}
									],
									"defaultValue": ""
								},
								{
									"name": "iIndex",
									"optional": false,
									"description": "<p>The <code>0</code>-based index the item should be inserted at; for a negative value of <code>iIndex</code>, the item is inserted at position 0; for a value greater than the current size of the aggregation, the item is inserted at the last position</p>",
									"types": [
										{
											"value": "int"
										}
									],
									"defaultValue": ""
								}
							],
							"description": "<p>Inserts a item into the aggregation <a target=\"_self\" href=\"api/sap.ui5.tooling.test.TestControl#methods/getItems\">items</a>.</p>",
							"href": "api/sap.ui5.tooling.test.TestControl#methods/insertItem",
							"code": "<pre>insertItem(oItem, iIndex) : this</pre>"
						},
						{
							"name": "removeAllItems",
							"visibility": "public",
							"returnValue": {
								"type": "sap.ui.core.Control[]",
								"description": "<p>An array of the removed elements (might be empty)</p>",
								"types": [
									{
										"value": "sap.ui.core.Control[]"
									}
								]
							},
							"description": "<p>Removes all the controls from the aggregation <a target=\"_self\" href=\"api/sap.ui5.tooling.test.TestControl#methods/getItems\">items</a>.</p><p>Additionally, it unregisters them from the hosting UIArea.</p>",
							"href": "api/sap.ui5.tooling.test.TestControl#methods/removeAllItems",
							"code": "<pre>removeAllItems() : sap.ui.core.Control[]</pre>"
						},
						{
							"name": "removeItem",
							"visibility": "public",
							"returnValue": {
								"type": "sap.ui.core.Control|null",
								"description": "<p>The removed item or <code>null</code></p>",
								"types": [
									{
										"value": "sap.ui.core.Control",
										"href": "api/sap.ui.core.Control",
										"linkEnabled": true
									},
									{
										"value": "null"
									}
								]
							},
							"parameters": [
								{
									"name": "vItem",
									"optional": false,
									"description": "<p>The item to remove or its index or id</p>",
									"types": [
										{
											"value": "int"
										},
										{
											"value": "string"
										},
										{
											"value": "sap.ui.core.Control",
											"linkEnabled": true,
											"href": "api/sap.ui.core.Control"
										}
									],
									"defaultValue": ""
								}
							],
							"description": "<p>Removes a item from the aggregation <a target=\"_self\" href=\"api/sap.ui5.tooling.test.TestControl#methods/getItems\">items</a>.</p>",
							"href": "api/sap.ui5.tooling.test.TestControl#methods/removeItem",
							"code": "<pre>removeItem(vItem) : sap.ui.core.Control|null</pre>"
						},
						{
							"name": "setColor",
							"visibility": "public",
							"returnValue": {
								"type": "this",
								"description": "<p>Reference to <code>this</code> in order to allow method chaining</p>",
								"types": [
									{
										"value": "this"
									}
								]
							},
							"parameters": [
								{
									"name": "sColor",
									"optional": true,
									"defaultValue": "Red",
									"description": "<p>New value for property <code>color</code></p>",
									"types": [
										{
											"value": "sap.ui5.tooling.test.TestEnum"
										}
									]
								}
							],
							"description": "<p>Sets a new value for property <a target=\"_self\" href=\"api/sap.ui5.tooling.test.TestControl#methods/getColor\">color</a>.</p><p>Property with an Enum</p><p>When called with a value of <code>null</code> or <code>undefined</code>, the default value of the property will be restored.</p><p>Default value is <code>Red</code>.</p>",
							"href": "api/sap.ui5.tooling.test.TestControl#methods/setColor",
							"code": "<pre>setColor(sColor?) : this</pre>"
						},
						{
							"name": "setSelectedItem",
							"visibility": "public",
							"returnValue": {
								"type": "this",
								"description": "<p>Reference to <code>this</code> in order to allow method chaining</p>",
								"types": [
									{
										"value": "this"
									}
								]
							},
							"parameters": [
								{
									"name": "oSelectedItem",
									"optional": false,
									"description": "<p>ID of an element which becomes the new target of this selectedItem association; alternatively, an element instance may be given</p>",
									"types": [
										{
											"value": "sap.ui.core.ID",
											"linkEnabled": true,
											"href": "api/sap.ui.core.ID"
										},
										{
											"value": "sap.ui.core.Control",
											"linkEnabled": true,
											"href": "api/sap.ui.core.Control"
										}
									],
									"defaultValue": ""
								}
							],
							"description": "<p>Sets the associated <a target=\"_self\" href=\"api/sap.ui5.tooling.test.TestControl#methods/getSelectedItem\">selectedItem</a>.</p>",
							"href": "api/sap.ui5.tooling.test.TestControl#methods/setSelectedItem",
							"code": "<pre>setSelectedItem(oSelectedItem) : this</pre>"
						},
						{
							"name": "setValue",
							"visibility": "public",
							"returnValue": {
								"type": "this",
								"description": "<p>Reference to <code>this</code> in order to allow method chaining</p>",
								"types": [
									{
										"value": "this"
									}
								]
							},
							"parameters": [
								{
									"name": "sValue",
									"optional": true,
									"defaultValue": "\"\"",
									"description": "<p>New value for property <code>value</code></p>",
									"types": [
										{
											"value": "string"
										}
									]
								}
							],
							"description": "<p>Sets a new value for property <a target=\"_self\" href=\"api/sap.ui5.tooling.test.TestControl#methods/getValue\">value</a>.</p><p>Property with type string</p><p>When called with a value of <code>null</code> or <code>undefined</code>, the default value of the property will be restored.</p><p>Default value is <code>empty string</code>.</p>",
							"deprecated": {
								"since": "2.0"
							},
							"href": "api/sap.ui5.tooling.test.TestControl#methods/setValue",
							"deprecatedText": "Deprecated as of version 2.0",
							"code": "<pre>setValue(sValue?) : this</pre>"
						}
					],
					"displayName": "sap.ui5.tooling.test.TestControl",
					"title": "class sap.ui5.tooling.test.TestControl",
					"subTitle": "Deprecated in version: 2.0",
					"deprecatedText": "Deprecated as of version 2.0. there's no replacement for this functionality"
				},
				{
					"kind": "enum",
					"name": "sap.ui5.tooling.test.TestEnum",
					"basename": "TestEnum",
					"resource": "sap/ui5/tooling/test/library.js",
					"module": "sap/ui5/tooling/test/library",
					"export": "TestEnum",
					"static": true,
					"visibility": "public",
					"description": "<p><p>Defines colors</p></p>",
					"ui5-metadata": {
						"stereotype": "enum"
					},
					"properties": [
						{
							"name": "sap.ui5.tooling.test.TestEnum.Blue",
							"visibility": "public",
							"description": "<p>Yellow</p>"
						},
						{
							"name": "sap.ui5.tooling.test.TestEnum.Red",
							"visibility": "public",
							"description": "<p>Red</p>"
						}
					],
					"displayName": "sap.ui5.tooling.test.TestEnum",
					"title": "enum sap.ui5.tooling.test.TestEnum",
					"subTitle": ""
				},
				{
					"name": "sap",
					"displayName": "sap",
					"kind": "namespace",
					"nodes": [
						{
							"name": "sap.ui5",
							"description": "",
							"href": "api/sap.ui5"
						}
					],
					"title": "namespace sap",
					"subTitle": ""
				},
				{
					"name": "sap.ui5",
					"displayName": "sap.ui5",
					"kind": "namespace",
					"nodes": [
						{
							"name": "sap.ui5.tooling",
							"description": "",
							"href": "api/sap.ui5.tooling"
						}
					],
					"title": "namespace sap.ui5",
					"subTitle": ""
				},
				{
					"name": "sap.ui5.tooling",
					"displayName": "sap.ui5.tooling",
					"kind": "namespace",
					"nodes": [
						{
							"name": "sap.ui5.tooling.test",
							"description": "<p>UI5 Tooling Test Library</p>",
							"href": "api/sap.ui5.tooling.test",
							"deprecated": true
						}
					],
					"title": "namespace sap.ui5.tooling",
					"subTitle": ""
				}
			]
		}
	);
});

test(".library with docuindex.json reference", async (t) => {
	const {sinon, transformApiJson} = t.context;

	const apiJsonPath = "/test-resources/sap/ui5/tooling/test/designtime/api.json";
	const fakeTargetPath = "/ignore/this/path/resource/will/be/returned";
	const dotLibraryPath = "/resources/sap/ui5/tooling/test/.library";
	const dependencyApiJsonPaths = [];

	const readFile = sinon.stub().yieldsAsync(new Error("Not found!"));

	readFile.withArgs("/resources/sap/ui5/tooling/test/.library").yieldsAsync(null, `
	<?xml version="1.0" encoding="UTF-8" ?>
	<library xmlns="http://www.sap.com/sap.ui.library.xsd" >

		<name>sap.ui5.tooling.test</name>
		<vendor>SAP SE</vendor>
		<copyright>Some copyright notice</copyright>
		<version>1.2.3</version>

		<documentation>UI5 Tooling Test Library</documentation>

		<appData>
			<documentation xmlns="http://www.sap.com/ui5/buildext/documentation"
				indexUrl="../../../../../test-resources/sap/ui5/tooling/test/demokit/docuindex.json"
				resolve="lib" />
		</appData>

	</library>`);

	readFile.withArgs("/test-resources/sap/ui5/tooling/test/designtime/api.json").yieldsAsync(null, JSON.stringify(
		{
			"$schema-ref": "http://schemas.sap.com/sapui5/designtime/api.json/1.0",
			"version": "2.1.0",
			"library": "sap.ui5.tooling.test",
			"symbols": [
				{
					"kind": "namespace",
					"name": "sap.ui5.tooling.test",
					"basename": "test",
					"resource": "sap/ui5/tooling/test/library.js",
					"module": "sap/ui5/tooling/test/library",
					"export": "",
					"static": true,
					"visibility": "public",
					"since": "1.0.0",
					"description": "UI5 Tooling Test Library",
					"deprecated": {
						"since": "2.0.0"
					}
				},
				{
					"kind": "class",
					"name": "sap.ui5.tooling.test.TestControl",
					"basename": "TestControl",
					"resource": "sap/ui5/tooling/test/TestControl.js",
					"module": "sap/ui5/tooling/test/TestControl",
					"export": "",
					"static": true,
					"visibility": "public",
					"extends": "sap.ui.core.Control",
					"description": "This control is just for UI5 Tooling testing purposes.",
					"ui5-metadata": {
						"stereotype": "control"
					},
					"constructor": {
						"visibility": "public",
						"parameters": [
							{
								"name": "sId",
								"type": "string",
								"optional": true,
								"description": "TEST DESCRIPTION",
							},
							{
								"name": "mSettings",
								"type": "object",
								"optional": true,
								"description": "TEST DESCRIPTION",
							}
						],
						"description": "TEST DESCRIPTION",
					},
					"methods": [
						{
							"name": "extend",
							"visibility": "public",
							"static": true,
							"returnValue": {
								"type": "function",
								"description": "TEST DESCRIPTION",
							},
							"parameters": [
								{
									"name": "sClassName",
									"type": "string",
									"optional": false,
									"description": "TEST DESCRIPTION",
								},
								{
									"name": "oClassInfo",
									"type": "object",
									"optional": true,
									"description": "TEST DESCRIPTION",
								},
								{
									"name": "FNMetaImpl",
									"type": "function",
									"optional": true,
									"description": "TEST DESCRIPTION",
								}
							],
							"description": "TEST DESCRIPTION",
						},
						{
							"name": "getMetadata",
							"visibility": "public",
							"static": true,
							"returnValue": {
								"type": "sap.ui.core.ElementMetadata",
								"description": "TEST DESCRIPTION",
							},
							"description": "TEST DESCRIPTION",
						}
					]
				},
			]
		}
	));

	readFile.withArgs("/test-resources/sap/ui5/tooling/test/demokit/docuindex.json").yieldsAsync(null, JSON.stringify(
		{
			"explored": {
				"entities": [
					// {
					// 	"id": "sap.ui5.tooling.test.TestControl"
					// }
				]
			}
		}
	));

	const readdir = sinon.stub().yieldsAsync(new Error("Not found!"));

	const fs = {readFile, readdir};

	const apiJsonContent = await transformApiJson(
		apiJsonPath, fakeTargetPath, dotLibraryPath, dependencyApiJsonPaths, "", {
			fs,
			returnOutputFiles: true
		}
	);

	t.deepEqual(JSON.parse(apiJsonContent), {
		"$schema-ref": "http://schemas.sap.com/sapui5/designtime/api.json/1.0",
		"version": "2.1.0",
		"library": "sap.ui5.tooling.test",
		"symbols": [
			{
				basename: "test",
				deprecatedText: "Deprecated as of version 2.0.0",
				description: "<p><p>UI5 Tooling Test Library</p></p>",
				displayName: "sap.ui5.tooling.test",
				export: "",
				kind: "namespace",
				module: "sap/ui5/tooling/test/library",
				nodes: [
					{
						"name": "sap.ui5.tooling.test.TestControl",
						"description": "<p>This control is just for UI5 Tooling testing purposes.</p>",
						"href": "api/sap.ui5.tooling.test.TestControl",
					}
				],
				name: "sap.ui5.tooling.test",
				resource: "sap/ui5/tooling/test/library.js",
				since: "1.0.0",
				static: true,
				subTitle: "Deprecated in version: 2.0.0",
				title: "namespace sap.ui5.tooling.test",
				visibility: "public",
			},
			{
				"kind": "class",
				"name": "sap.ui5.tooling.test.TestControl",
				"basename": "TestControl",
				"resource": "sap/ui5/tooling/test/TestControl.js",
				"module": "sap/ui5/tooling/test/TestControl",
				"export": "",
				"static": true,
				"visibility": "public",
				"extends": "sap.ui.core.Control",
				"description": "<p>This control is just for UI5 Tooling testing purposes.</p>",
				"ui5-metadata": {
					"stereotype": "control"
				},
				"constructor": {
					"visibility": "public",
					"parameters": [
						{
							"name": "sId",
							"optional": true,
							"description": "<p>TEST DESCRIPTION</p>",
							"phoneName": "sId",
							"depth": 0,
							"types": [
								{
									"name": "string",
									"linkEnabled": false
								}
							],
							"defaultValue": ""
						},
						{
							"name": "mSettings",
							"optional": true,
							"description": "<p>TEST DESCRIPTION</p>",
							"phoneName": "mSettings",
							"depth": 0,
							"types": [
								{
									"name": "object",
									"linkEnabled": false
								}
							],
							"defaultValue": ""
						}
					],
					"description": "<p>TEST DESCRIPTION</p>",
					"references": [],
					"codeExample": "<pre>new sap.ui5.tooling.test.TestControl(sId?, mSettings?)</pre>"
				},
				"methods": [
					{
						"name": "sap.ui5.tooling.test.TestControl.extend",
						"visibility": "public",
						"static": true,
						"returnValue": {
							"type": "function",
							"description": "<p>TEST DESCRIPTION</p>",
							"types": [
								{
									"value": "function"
								}
							]
						},
						"parameters": [
							{
								"name": "sClassName",
								"optional": false,
								"description": "<p>TEST DESCRIPTION</p>",
								"types": [
									{
										"value": "string"
									}
								],
								"defaultValue": ""
							},
							{
								"name": "oClassInfo",
								"optional": true,
								"description": "<p>TEST DESCRIPTION</p>",
								"types": [
									{
										"value": "object"
									}
								],
								"defaultValue": ""
							},
							{
								"name": "FNMetaImpl",
								"optional": true,
								"description": "<p>TEST DESCRIPTION</p>",
								"types": [
									{
										"value": "function"
									}
								],
								"defaultValue": ""
							}
						],
						"description": "<p>TEST DESCRIPTION</p>",
						"href": "api/sap.ui5.tooling.test.TestControl#methods/sap.ui5.tooling.test.TestControl.extend",
						"code": "<pre>sap.ui5.tooling.test.TestControl.extend(sClassName, oClassInfo?, FNMetaImpl?) : function</pre>"
					},
					{
						"name": "sap.ui5.tooling.test.TestControl.getMetadata",
						"visibility": "public",
						"static": true,
						"returnValue": {
							"type": "sap.ui.core.ElementMetadata",
							"description": "<p>TEST DESCRIPTION</p>",
							"types": [
								{
									"value": "sap.ui.core.ElementMetadata",
									"href": "api/sap.ui.core.ElementMetadata",
									"linkEnabled": true
								}
							]
						},
						"description": "<p>TEST DESCRIPTION</p>",
						"href": "api/sap.ui5.tooling.test.TestControl#methods/sap.ui5.tooling.test.TestControl.getMetadata",
						"code": "<pre>sap.ui5.tooling.test.TestControl.getMetadata() : sap.ui.core.ElementMetadata</pre>"
					}
				],
				"displayName": "sap.ui5.tooling.test.TestControl",
				"title": "class sap.ui5.tooling.test.TestControl",
				"subTitle": "",
			},
			{
				displayName: "sap",
				kind: "namespace",
				name: "sap",
				nodes: [
					{
						description: "",
						href: "api/sap.ui5",
						name: "sap.ui5",
					},
				],
				subTitle: "",
				title: "namespace sap",
			},
			{
				displayName: "sap.ui5",
				kind: "namespace",
				name: "sap.ui5",
				nodes: [
					{
						description: "",
						href: "api/sap.ui5.tooling",
						name: "sap.ui5.tooling",
					},
				],
				subTitle: "",
				title: "namespace sap.ui5",
			},
			{
				displayName: "sap.ui5.tooling",
				kind: "namespace",
				name: "sap.ui5.tooling",
				nodes: [
					{
						deprecated: true,
						description: "<p>UI5 Tooling Test Library</p>",
						href: "api/sap.ui5.tooling.test",
						name: "sap.ui5.tooling.test",
					},
				],
				subTitle: "",
				title: "namespace sap.ui5.tooling",
			},
		]
	});
});

test(".library with <ownership> information", async (t) => {
	const {sinon, transformApiJson} = t.context;

	const apiJsonPath = "/test-resources/sap/ui5/tooling/test/designtime/api.json";
	const fakeTargetPath = "/ignore/this/path/resource/will/be/returned";
	const dotLibraryPath = "/resources/sap/ui5/tooling/test/.library";
	const dependencyApiJsonPaths = [];

	const readFile = sinon.stub().yieldsAsync(new Error("Not found!"));

	readFile.withArgs("/resources/sap/ui5/tooling/test/.library").yieldsAsync(null, `
	<?xml version="1.0" encoding="UTF-8" ?>
	<library xmlns="http://www.sap.com/sap.ui.library.xsd" >

		<name>sap.ui5.tooling.test</name>
		<vendor>SAP SE</vendor>
		<copyright>Some copyright notice</copyright>
		<version>1.2.3</version>

		<documentation>UI5 Tooling Test Library</documentation>

		<appData>
			<ownership xmlns="http://www.sap.com/ui5/buildext/ownership">
				<component>UI5-TOOLING</component> <!-- default component for library, embedded text as a shortcut for <name>text</name> -->
				<component>
					<name>UI5-TOOLING-EXT</name>
					<modules>
						<module>sap/ui5/tooling/test/ext/*</module>
					</modules>
				</component>
			<ownership>
		</appData>

	</library>`);

	readFile.withArgs("/test-resources/sap/ui5/tooling/test/designtime/api.json").yieldsAsync(null, JSON.stringify(
		{
			"$schema-ref": "http://schemas.sap.com/sapui5/designtime/api.json/1.0",
			"version": "2.1.0",
			"library": "sap.ui5.tooling.test",
			"symbols": [
				{
					"kind": "namespace",
					"name": "sap.ui5.tooling.test",
					"basename": "test",
					"resource": "sap/ui5/tooling/test/library.js",
					"module": "sap/ui5/tooling/test/library",
					"export": "",
					"static": true,
					"visibility": "public",
					"description": "UI5 Tooling Test Library",
				},
				{
					"kind": "namespace",
					"name": "sap.ui5.tooling.test.ext",
					"basename": "ext",
					"resource": "sap/ui5/tooling/test/ext/ext.js",
					"module": "sap/ui5/tooling/test/ext/ext",
					"export": "",
					"static": true,
					"visibility": "public",
					"description": "UI5 Tooling Test Library - Extension",
				}
			]
		}
	));

	const readdir = sinon.stub().yieldsAsync(new Error("Not found!"));

	const fs = {readFile, readdir};

	const apiJsonContent = await transformApiJson(
		apiJsonPath, fakeTargetPath, dotLibraryPath, dependencyApiJsonPaths, "", {
			fs,
			returnOutputFiles: true
		}
	);

	t.deepEqual(JSON.parse(apiJsonContent), {
		"$schema-ref": "http://schemas.sap.com/sapui5/designtime/api.json/1.0",
		"version": "2.1.0",
		"library": "sap.ui5.tooling.test",
		"defaultComponent": "UI5-TOOLING",
		"symbols": [
			{
				basename: "test",
				component: "UI5-TOOLING",
				description: "<p><p>UI5 Tooling Test Library</p></p>",
				displayName: "sap.ui5.tooling.test",
				export: "",
				kind: "namespace",
				module: "sap/ui5/tooling/test/library",
				name: "sap.ui5.tooling.test",
				nodes: [
					{
						description: "<p>UI5 Tooling Test Library - Extension</p>",
						href: "api/sap.ui5.tooling.test.ext",
						name: "sap.ui5.tooling.test.ext",
					}
				],
				resource: "sap/ui5/tooling/test/library.js",
				static: true,
				subTitle: "",
				title: "namespace sap.ui5.tooling.test",
				visibility: "public",
			},
			{
				basename: "ext",
				component: "UI5-TOOLING-EXT",
				description: "<p><p>UI5 Tooling Test Library - Extension</p></p>",
				displayName: "sap.ui5.tooling.test.ext",
				export: "",
				kind: "namespace",
				module: "sap/ui5/tooling/test/ext/ext",
				name: "sap.ui5.tooling.test.ext",
				resource: "sap/ui5/tooling/test/ext/ext.js",
				static: true,
				subTitle: "",
				title: "namespace sap.ui5.tooling.test.ext",
				visibility: "public",
			},
			{
				displayName: "sap",
				kind: "namespace",
				name: "sap",
				nodes: [
					{
						description: "",
						href: "api/sap.ui5",
						name: "sap.ui5",
					},
				],
				subTitle: "",
				title: "namespace sap",
			},
			{
				displayName: "sap.ui5",
				kind: "namespace",
				name: "sap.ui5",
				nodes: [
					{
						description: "",
						href: "api/sap.ui5.tooling",
						name: "sap.ui5.tooling",
					},
				],
				subTitle: "",
				title: "namespace sap.ui5",
			},
			{
				displayName: "sap.ui5.tooling",
				kind: "namespace",
				name: "sap.ui5.tooling",
				nodes: [
					{
						description: "<p>UI5 Tooling Test Library</p>",
						href: "api/sap.ui5.tooling.test",
						name: "sap.ui5.tooling.test",
					},
				],
				subTitle: "",
				title: "namespace sap.ui5.tooling",
			},
		]
	});
});
