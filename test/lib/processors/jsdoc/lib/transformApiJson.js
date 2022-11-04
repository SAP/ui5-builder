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

test("Test with library, control, enum", async (t) => {
	const {sinon, transformApiJson} = t.context;

	const apiJsonPath = "/test-resources/sap/ui5/tooling/test/designtime/api.json";
	const fakeTargetPath = "/ignore/this/path/resource/will/be/returned";
	const dotLibraryPath = "/resources/sap/ui5/tooling/test/.library";
	const dependencyApiJsonPaths = [
		"/resources/some/path/x/api.json",
		"/resources/some/path/y/api.json"
	];

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
		/* eslint-disable max-len */
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
						"properties": [
							{
								"name": "value",
								"type": "int",
								"defaultValue": 0,
								"group": "Misc",
								"visibility": "public",
								"description": "Property with type int",
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
						"events": [
							{
								"name": "press",
								"visibility": "public",
								"description": "Event is fired when the user clicks the control.",
								"methods": [
									"attachPress",
									"detachPress",
									"firePress"
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
						"description": "Constructor for a new TestControl.\n\nAccepts an object literal <code>mSettings</code> that defines initial property values, aggregated and associated objects as well as event handlers. See {@link sap.ui.base.ManagedObject#constructor} for a general description of the syntax of the settings object."
					},
					"events": [
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
							"description": "Event is fired when the user clicks the control."
						}
					],
					"methods": [
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
							"description": "Attaches event handler <code>fnFunction</code> to the {@link #event:press press} event of this <code>sap.ui5.tooling.test.TestControl</code>.\n\nWhen called, the context of the event handler (its <code>this</code>) will be bound to <code>oListener</code> if specified, otherwise it will be bound to this <code>sap.ui5.tooling.test.TestControl</code> itself.\n\nEvent is fired when the user clicks the control."
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
							"description": "Detaches event handler <code>fnFunction</code> from the {@link #event:press press} event of this <code>sap.ui5.tooling.test.TestControl</code>.\n\nThe passed function and listener object must match the ones used for event registration."
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
							"description": "Fires event {@link #event:press press} to attached listeners."
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
							"name": "getValue",
							"visibility": "public",
							"returnValue": {
								"type": "int",
								"description": "Value of property <code>value</code>"
							},
							"description": "Gets current value of property {@link #getValue value}.\n\nProperty with type int\n\nDefault value is <code>0</code>."
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
							"name": "setValue",
							"visibility": "public",
							"returnValue": {
								"type": "this",
								"description": "Reference to <code>this</code> in order to allow method chaining"
							},
							"parameters": [
								{
									"name": "iValue",
									"type": "int",
									"optional": true,
									"defaultValue": 0,
									"description": "New value for property <code>value</code>"
								}
							],
							"description": "Sets a new value for property {@link #getValue value}.\n\nProperty with type int\n\nWhen called with a value of <code>null</code> or <code>undefined</code>, the default value of the property will be restored.\n\nDefault value is <code>0</code>."
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
		/* eslint-enable max-len */
	));

	const readdir = sinon.stub().yieldsAsync(new Error("Not found!"));

	const fs = {readFile, readdir};

	const apiJsonContent = await transformApiJson(
		apiJsonPath, fakeTargetPath, dotLibraryPath, dependencyApiJsonPaths, "", {
			fs,
			returnOutputFiles: true
		}
	);

	/* eslint-disable max-len */
	t.deepEqual(JSON.parse(apiJsonContent), {
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
							"type": "int",
							"defaultValue": 0,
							"group": "Misc",
							"visibility": "public",
							"description": "<p>Property with type int</p>",
							"methods": [
								"getValue",
								"setValue"
							]
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
					"description": "<p>Constructor for a new TestControl.</p><p>Accepts an object literal <code>mSettings</code> that defines initial property values, aggregated and associated objects as well as event handlers. See <a target=\"_self\" href=\"api/sap.ui.base.ManagedObject#constructor\">sap.ui.base.ManagedObject#constructor</a> for a general description of the syntax of the settings object.</p>",
					"references": [],
					"codeExample": "<pre>new sap.ui5.tooling.test.TestControl(sId?, mSettings?)</pre>"
				},
				"events": [
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
						"description": "<p>Event is fired when the user clicks the control.</p>"
					}
				],
				"methods": [
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
						"href": "api/sap.ui5.tooling.test.TestControl#methods/attachPress",
						"code": "<pre>attachPress(oData?, fnFunction, oListener?) : this</pre>"
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
						"href": "api/sap.ui5.tooling.test.TestControl#methods/detachPress",
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
						"href": "api/sap.ui5.tooling.test.TestControl#methods/firePress",
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
						"name": "getValue",
						"visibility": "public",
						"returnValue": {
							"type": "int",
							"description": "<p>Value of property <code>value</code></p>",
							"types": [
								{
									"value": "int"
								}
							]
						},
						"description": "<p>Gets current value of property <a target=\"_self\" href=\"api/sap.ui5.tooling.test.TestControl#methods/getValue\">value</a>.</p><p>Property with type int</p><p>Default value is <code>0</code>.</p>",
						"href": "api/sap.ui5.tooling.test.TestControl#methods/getValue",
						"code": "<pre>getValue() : int</pre>"
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
								"name": "iValue",
								"optional": true,
								"defaultValue": 0,
								"description": "<p>New value for property <code>value</code></p>",
								"types": [
									{
										"value": "int"
									}
								]
							}
						],
						"description": "<p>Sets a new value for property <a target=\"_self\" href=\"api/sap.ui5.tooling.test.TestControl#methods/getValue\">value</a>.</p><p>Property with type int</p><p>When called with a value of <code>null</code> or <code>undefined</code>, the default value of the property will be restored.</p><p>Default value is <code>0</code>.</p>",
						"href": "api/sap.ui5.tooling.test.TestControl#methods/setValue",
						"code": "<pre>setValue(iValue?) : this</pre>"
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
	});
	/* eslint-enable max-len */
});

test("Test with docuindex.json reference", async (t) => {
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
		"symbols": [
			{
				basename: "test",
				deprecatedText: "Deprecated as of version 2.0.0",
				description: "<p><p>UI5 Tooling Test Library</p></p>",
				displayName: "sap.ui5.tooling.test",
				export: "",
				kind: "namespace",
				module: "sap/ui5/tooling/test/library",
				name: "sap.ui5.tooling.test",
				resource: "sap/ui5/tooling/test/library.js",
				since: "1.0.0",
				static: true,
				subTitle: "Deprecated in version: 2.0.0",
				title: "namespace sap.ui5.tooling.test",
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
