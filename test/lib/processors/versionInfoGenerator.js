import test from "ava";
import sinon from "sinon";
import esmock from "esmock";
import logger from "@ui5/logger";

test.beforeEach(async (t) => {
	t.context.warnLogStub = sinon.stub();
	t.context.infoLogStub = sinon.stub();
	t.context.verboseLogStub = sinon.stub();
	t.context.sillyLogStub = sinon.stub();
	sinon.stub(logger, "getLogger").returns({
		warn: t.context.warnLogStub,
		info: t.context.infoLogStub,
		verbose: t.context.verboseLogStub,
		silly: t.context.sillyLogStub,
		isLevelEnabled: () => true
	});
	t.context.versionInfoGenerator = await esmock("../../../lib/processors/versionInfoGenerator.js");
});

test.afterEach.always((t) => {
	sinon.restore();
});

test("versionInfoGenerator missing parameters", async (t) => {
	const {versionInfoGenerator} = t.context;
	const error = await t.throwsAsync(versionInfoGenerator({options: {}}));
	t.is(error.message, "[versionInfoGenerator]: Missing options parameters");
});

const assertVersionInfoContent = (t, oExpectedVersionInfo, sActualContent) => {
	const currentVersionInfo = JSON.parse(sActualContent);

	t.is(currentVersionInfo.buildTimestamp.length, 12, "Timestamp should have length of 12 (yyyyMMddHHmm)");

	delete currentVersionInfo.buildTimestamp; // removing to allow deep comparison
	currentVersionInfo.libraries.forEach((lib) => {
		t.is(lib.buildTimestamp.length, 12, "Timestamp should have length of 12 (yyyyMMddHHmm)");
		delete lib.buildTimestamp; // removing to allow deep comparison
	});


	t.deepEqual(currentVersionInfo, oExpectedVersionInfo, "Correct content");
};

test.serial("versionInfoGenerator empty libraryInfos parameter", async (t) => {
	const {versionInfoGenerator} = t.context;
	const versionInfos = await versionInfoGenerator({options: {
		rootProjectName: "myname", rootProjectVersion: "1.33.7", libraryInfos: []}});

	const resource = versionInfos[0];
	const result = await resource.getString();

	const oExpected = {
		"name": "myname",
		"version": "1.33.7",
		"scmRevision": "",
		"libraries": []
	};
	assertVersionInfoContent(t, oExpected, result);
});


test.serial("versionInfoGenerator simple library infos", async (t) => {
	const {versionInfoGenerator} = t.context;
	const options = {
		rootProjectName: "myname", rootProjectVersion: "1.33.7", libraryInfos: [
			{name: "my.lib", version: "1.2.3"}
		]};
	const versionInfos = await versionInfoGenerator({options});

	const resource = versionInfos[0];
	const result = await resource.getString();

	const oExpected = {
		"name": "myname",
		"version": "1.33.7",
		"scmRevision": "",
		"libraries": [
			{
				"name": "my.lib",
				"version": "1.2.3",
				"scmRevision": ""
			}
		]
	};
	assertVersionInfoContent(t, oExpected, result);
	t.is(t.context.verboseLogStub.callCount, 1);
	t.is(t.context.verboseLogStub.getCall(0).args[0],
		"Cannot add meta information for library 'my.lib'. The manifest.json file cannot be found");
});

test.serial("versionInfoGenerator manifest without libs", async (t) => {
	const {versionInfoGenerator} = t.context;
	const libAManifest = {
		getPath: () => {
			return "/resources/lib/a/manifest.json";
		},
		getString: async () => {
			return JSON.stringify({
				"sap.app": {
					"id": "lib.a",
					"embeds": []
				},
				"sap.ui5": {
					"dependencies": {
						"minUI5Version": "1.84"
					}
				}
			});
		}
	};
	const libA = {name: "lib.a", version: "1.2.3", libraryManifest: libAManifest};

	const options = {
		rootProjectName: "myname", rootProjectVersion: "1.33.7", libraryInfos: [
			libA
		]};
	const versionInfos = await versionInfoGenerator({options});

	const resource = versionInfos[0];
	const result = await resource.getString();

	const oExpected = {
		"name": "myname",
		"version": "1.33.7",
		"scmRevision": "",
		"libraries": [
			{
				"name": "lib.a",
				"version": "1.2.3",
				"scmRevision": ""
			}
		]
	};
	assertVersionInfoContent(t, oExpected, result);
	t.is(t.context.infoLogStub.callCount, 0);
	t.is(t.context.warnLogStub.callCount, 0);
});

test.serial("versionInfoGenerator library infos with dependencies", async (t) => {
	const {versionInfoGenerator} = t.context;
	const libAManifest = {
		getPath: () => {
			return "/resources/lib/a/manifest.json";
		},
		getString: async () => {
			return JSON.stringify({
				"sap.app": {
					"id": "lib.a",
					"embeds": []
				},
				"sap.ui5": {
					"dependencies": {
						"minUI5Version": "1.84",
						"libs": {
							"my.dep": {
								"minVersion": "1.84.0",
								"lazy": false
							}
						}
					}
				}
			});
		}
	};
	const libA = {name: "lib.a", version: "1.2.3", libraryManifest: libAManifest};
	const myDepManifest = {
		getPath: () => {
			return "/resources/my/dep/manifest.json";
		},
		getString: async () => {
			return JSON.stringify({
				"sap.app": {
					"id": "my.dep",
					"embeds": []
				},
				"sap.ui5": {
					"dependencies": {
						"minUI5Version": "1.84",
						"libs": {}
					}
				}
			});
		}
	};
	const myDep = {name: "my.dep", version: "1.2.3", libraryManifest: myDepManifest};
	const options = {
		rootProjectName: "myname", rootProjectVersion: "1.33.7", libraryInfos: [
			libA, myDep
		]};
	const versionInfos = await versionInfoGenerator({options});

	const resource = versionInfos[0];
	const result = await resource.getString();

	const oExpected = {
		"name": "myname",
		"version": "1.33.7",
		"scmRevision": "",
		"libraries": [
			{
				"name": "lib.a",
				"version": "1.2.3",
				"scmRevision": "",
				"manifestHints": {
					"dependencies": {
						"libs": {
							"my.dep": {}
						}
					}
				}
			},
			{
				"name": "my.dep",
				"version": "1.2.3",
				"scmRevision": ""
			}
		]
	};
	assertVersionInfoContent(t, oExpected, result);
	t.is(t.context.infoLogStub.callCount, 0);
	t.is(t.context.warnLogStub.callCount, 0);
});

test.serial("versionInfoGenerator library infos with dependencies; w/o minVersion and minUI5Version", async (t) => {
	const {versionInfoGenerator} = t.context;
	const libAManifest = {
		getPath: () => {
			return "/resources/lib/a/manifest.json";
		},
		getString: async () => {
			return JSON.stringify({
				"sap.app": {
					"id": "lib.a",
					"embeds": []
				},
				"sap.ui5": {
					"dependencies": {
						"minUI5Version": "",
						"libs": {
							"my.dep": {
								"minVersion": "",
								"lazy": false
							}
						}
					}
				}
			});
		}
	};
	const libA = {name: "lib.a", version: "1.2.3", libraryManifest: libAManifest};
	const options = {rootProjectName: "myname", rootProjectVersion: "1.33.7", libraryInfos: [libA]};
	const versionInfos = await versionInfoGenerator({options});

	const resource = versionInfos[0];
	const result = await resource.getString();

	const oExpected = {
		"name": "myname",
		"version": "1.33.7",
		"scmRevision": "",
		"libraries": [
			{
				"name": "lib.a",
				"version": "1.2.3",
				"scmRevision": "",
				"manifestHints": {
					"dependencies": {
						"libs": {
							"my.dep": {}
						}
					}
				}
			}
		]
	};
	assertVersionInfoContent(t, oExpected, result);
	t.is(t.context.infoLogStub.callCount, 1);
	t.is(t.context.infoLogStub.getCall(0).args[0],
		"Cannot find dependency 'my.dep' " +
		"defined in the manifest.json or .library file of project 'lib.a'. " +
		"This might prevent some UI5 runtime performance optimizations from taking effect. " +
		"Please double check your project's dependency configuration.");
	t.is(t.context.warnLogStub.callCount, 0);
});

test.serial("versionInfoGenerator library infos with embeds", async (t) => {
	const {versionInfoGenerator} = t.context;
	const libAManifest = {
		getPath: () => {
			return "/resources/lib/a/manifest.json";
		},
		getString: async () => {
			return JSON.stringify({
				"sap.app": {
					"id": "lib.a",
					"embeds": ["sub"]
				},
				"sap.ui5": {
					"dependencies": {
						"minUI5Version": "1.84",
						"libs": {}
					}
				}
			});
		}
	};
	const subManifest = {
		getPath: () => {
			return "/resources/lib/a/sub/manifest.json";
		},
		getString: async () => {
			return JSON.stringify({
				"sap.app": {
					"id": "lib.a.sub",
					"embeds": []
				},
				"sap.ui5": {
					"dependencies": {
						"minUI5Version": "1.84",
						"libs": {}
					}
				}
			});
		}
	};
	const libA = {name: "lib.a", version: "1.2.3", libraryManifest: libAManifest, embeddedManifests: [subManifest]};

	const options = {
		rootProjectName: "myname", rootProjectVersion: "1.33.7", libraryInfos: [
			libA
		]};
	const versionInfos = await versionInfoGenerator({options});

	const resource = versionInfos[0];
	const result = await resource.getString();

	const oExpected = {
		"name": "myname",
		"version": "1.33.7",
		"scmRevision": "",
		"libraries": [
			{
				"name": "lib.a",
				"version": "1.2.3",
				"scmRevision": ""
			}
		],
		"components": {
			"lib.a.sub": {
				"hasOwnPreload": true,
				"library": "lib.a"
			}
		}
	};
	assertVersionInfoContent(t, oExpected, result);
	t.is(t.context.infoLogStub.callCount, 0);
	t.is(t.context.warnLogStub.callCount, 0);
});

test.serial("versionInfoGenerator library infos with no embeds", async (t) => {
	const {versionInfoGenerator} = t.context;
	const libAManifest = {
		getPath: () => {
			return "/resources/lib/a/manifest.json";
		},
		getString: async () => {
			return JSON.stringify({
				"sap.app": {
					"id": "lib.a"
				},
				"sap.ui5": {
					"dependencies": {
						"minUI5Version": "1.84",
						"libs": {
							"my.dep": {
								"minVersion": "1.84.0",
								"lazy": false
							}
						}
					}
				}
			});
		}
	};
	const libA = {name: "lib.a", version: "1.2.3", libraryManifest: libAManifest};
	const myDepManifest = {
		getPath: () => {
			return "/resources/my/dep/manifest.json";
		},
		getString: async () => {
			return JSON.stringify({
				"sap.app": {
					"id": "my.dep"
				},
				"sap.ui5": {
					"dependencies": {
						"minUI5Version": "1.84",
						"libs": {}
					}
				}
			});
		}
	};
	const myDep = {name: "my.dep", version: "1.2.3", libraryManifest: myDepManifest};
	const options = {
		rootProjectName: "myname", rootProjectVersion: "1.33.7", libraryInfos: [
			libA, myDep
		]};
	const versionInfos = await versionInfoGenerator({options});

	const resource = versionInfos[0];
	const result = await resource.getString();

	const oExpected = {
		"name": "myname",
		"version": "1.33.7",
		"scmRevision": "",
		"libraries": [
			{
				"name": "lib.a",
				"version": "1.2.3",
				"scmRevision": "",
				"manifestHints": {
					"dependencies": {
						"libs": {
							"my.dep": {}
						}
					}
				}
			},
			{
				"name": "my.dep",
				"version": "1.2.3",
				"scmRevision": ""
			}
		]
	};
	assertVersionInfoContent(t, oExpected, result);
	t.is(t.context.infoLogStub.callCount, 0);
	t.is(t.context.warnLogStub.callCount, 0);
});

test.serial("versionInfoGenerator library infos with embeds and embeddedBy (hasOwnPreload)", async (t) => {
	const {versionInfoGenerator} = t.context;
	const libAManifest = {
		getPath: () => {
			return "/resources/lib/a/manifest.json";
		},
		getString: async () => {
			return JSON.stringify({
				"sap.app": {
					"id": "lib.a",
					"embeds": ["sub"]
				},
				"sap.ui5": {
					"dependencies": {
						"minUI5Version": "1.84",
						"libs": {}
					}
				}
			});
		}
	};
	const subManifest = {
		getPath: () => {
			return "/resources/lib/a/sub/manifest.json";
		},
		getString: async () => {
			return JSON.stringify({
				"sap.app": {
					"id": "lib.a.sub",
					"embeds": [],
					"embeddedBy": "../"
				},
				"sap.ui5": {
					"dependencies": {
						"minUI5Version": "1.84",
						"libs": {}
					}
				}
			});
		}
	};
	const libA = {name: "lib.a", version: "1.2.3", libraryManifest: libAManifest, embeddedManifests: [subManifest]};

	const options = {
		rootProjectName: "myname", rootProjectVersion: "1.33.7", libraryInfos: [
			libA
		]};
	const versionInfos = await versionInfoGenerator({options});

	const resource = versionInfos[0];
	const result = await resource.getString();

	const oExpected = {
		"name": "myname",
		"version": "1.33.7",
		"scmRevision": "",
		"libraries": [
			{
				"name": "lib.a",
				"version": "1.2.3",
				"scmRevision": ""
			}
		],
		"components": {
			"lib.a.sub": {
				"library": "lib.a"
			}
		}
	};
	assertVersionInfoContent(t, oExpected, result);
	t.is(t.context.infoLogStub.callCount, 0);
	t.is(t.context.warnLogStub.callCount, 0);
});
