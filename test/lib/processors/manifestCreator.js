const test = require("ava");
const sinon = require("sinon");
const mock = require("mock-require");

const manifestCreator = require("../../../lib/processors/manifestCreator");

const libraryContent = `<?xml version="1.0" encoding="UTF-8" ?>
<library xmlns="http://www.sap.com/sap.ui.library.xsd" >
	<name>library.e</name>
	<vendor>SAP SE</vendor>
	<copyright>my copyright</copyright>
	<version>1.0.0</version>
	<documentation>Library E</documentation>

	<dependencies>
	    <dependency>
	      <libraryName>sap.ui.core</libraryName>
	    </dependency>
	</dependencies>
</library>`;

const expectedManifestContent = `{
  "_version": "1.9.0",
  "sap.app": {
    "id": "library.e",
    "type": "library",
    "embeds": [],
    "applicationVersion": {
      "version": "1.0.0"
    },
    "title": "Library E",
    "description": "Library E",
    "resources": "resources.json",
    "offline": true
  },
  "sap.ui": {
    "technology": "UI5",
    "supportedThemes": []
  },
  "sap.ui5": {
    "dependencies": {
      "libs": {
        "sap.ui.core": {}
      }
    },
    "library": {
      "i18n": false
    }
  }
}`;

test.afterEach.always((t) => {
	mock.stopAll();
	sinon.restore();
});

test("default manifest creation", async (t) => {
	const libraryResource = {
		getPath: () => {
			return "/resources/sap/ui/mine/.library";
		},
		getString: async () => {
			return libraryContent;
		},
		_project: {
			dependencies: [{
				metadata: {
					name: "sap.ui.core"
				}
			}]
		}
	};

	const result = await manifestCreator({libraryResource, resources: [], options: {}});
	t.is(await result.getString(), expectedManifestContent, "Correct result returned");
});

test.serial("manifest creation for sap/apf", async (t) => {
	const logger = require("@ui5/logger");
	const verboseLogStub = sinon.stub();
	const myLoggerInstance = {
		verbose: verboseLogStub
	};
	sinon.stub(logger, "getLogger").returns(myLoggerInstance);
	const manifestCreatorWithStub = mock.reRequire("../../../lib/processors/manifestCreator");


	const libraryResource = {
		getPath: () => {
			return "/resources/sap/apf/.library";
		},
		getString: async () => {
			return libraryContent;
		},
		_project: {
			dependencies: [{
				metadata: {
					name: "sap.ui.core"
				}
			}]
		}
	};

	const componentResource = {
		getPath: () => {
			return "/resources/sap/apf/Component.js";
		}
	};

	const result = await manifestCreatorWithStub({libraryResource, resources: [componentResource], options: {}});
	t.is(await result.getString(), expectedManifestContent, "Correct result returned");

	t.is(verboseLogStub.callCount, 9);
	t.is(verboseLogStub.getCall(1).args[0],
		"Package %s contains both '*.library' and 'Component.js'. " +
		"This is a known issue but can't be solved due to backward compatibility.");
	t.is(verboseLogStub.getCall(1).args[1], "/resources/sap/apf");
});

test.serial("manifest creation with embedded component", async (t) => {
	const expectedManifestContent = JSON.stringify({
		"_version": "1.9.0",
		"sap.app": {
			"id": "sap.lib1",
			"type": "library",
			"embeds": [
				"component1"
			],
			"applicationVersion": {
				"version": "1.0.0"
			},
			"title": "sap.lib1",
			"resources": "resources.json",
			"offline": true
		},
		"sap.ui": {
			"technology": "UI5",
			"supportedThemes": []
		},
		"sap.ui5": {
			"dependencies": {
				"libs": {}
			},
			"library": {
				"i18n": false
			}
		}
	}, null, 2);

	const logger = require("@ui5/logger");
	const verboseLogStub = sinon.stub();
	const errorLogStub = sinon.stub();
	const myLoggerInstance = {
		verbose: verboseLogStub,
		error: errorLogStub
	};
	sinon.stub(logger, "getLogger").returns(myLoggerInstance);
	const manifestCreatorWithStub = mock.reRequire("../../../lib/processors/manifestCreator");

	const libraryResource = {
		getPath: () => {
			return "/resources/sap/lib1/.library";
		},
		getString: async () => {
			return `<?xml version="1.0" encoding="UTF-8" ?>
			<library xmlns="http://www.sap.com/sap.ui.library.xsd" >
				<name>sap.lib1</name>
				<version>1.0.0</version>
			</library>`;
		},
		_project: {
			dependencies: [{
				metadata: {
					name: "sap.ui.core"
				}
			}]
		}
	};

	const componentResource = {
		getPath: () => {
			return "/resources/sap/lib1/component1/Component.js";
		}
	};
	const componentManifestResource = {
		getPath: () => {
			return "/resources/sap/lib1/component1/manifest.json";
		},
		getString: async () => {
			return JSON.stringify({
				"sap.app": {
					"embeddedBy": "../"
				}
			});
		}
	};

	const result = await manifestCreatorWithStub({
		libraryResource,
		resources: [
			componentResource,
			componentManifestResource
		]
	});
	t.is(await result.getString(), expectedManifestContent, "Correct result returned");

	t.is(errorLogStub.callCount, 0);

	t.true(verboseLogStub.callCount >= 2, "There should be at least 2 verbose log calls");
	t.deepEqual(verboseLogStub.getCall(0).args, [
		"checking component at %s", "/resources/sap/lib1/component1"
	]);
	t.deepEqual(verboseLogStub.getCall(1).args, [
		"  component's 'sap.app/embeddedBy' property points to library, list it as 'embedded'"
	]);
});
