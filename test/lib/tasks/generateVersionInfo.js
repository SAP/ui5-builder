const test = require("ava");

const generateVersionInfo = require("../../../lib/tasks/generateVersionInfo");
const path = require("path");
const ui5Fs = require("@ui5/fs");
const resourceFactory = ui5Fs.resourceFactory;

function createWorkspace() {
	return resourceFactory.createAdapter({
		virBasePath: "/",
		project: {
			metadata: {
				name: "test.lib"
			},
			version: "2.0.0",
			dependencies: [
				{
					metadata: {
						name: "sap.ui.core"
					},
					version: "1.0.0"
				}
			]
		}
	});
}

function createDependencies(oOptions = {
	virBasePath: "/resources",
	fsBasePath: path.join(__dirname, "..", "..", "fixtures", "sap.ui.core-evo", "main", "src")
}) {
	oOptions = Object.assign(oOptions, {
		project: {
			metadata: {
				name: "test.lib3"
			},
			version: "3.0.0"}
	});
	return resourceFactory.createAdapter(oOptions);
}

async function createOptions(t, options) {
	const {workspace, dependencies, resources} = t.context;

	await Promise.all(resources.map((resource) => workspace.write(resource)));
	const oOptions = {
		workspace,
		dependencies
	};
	oOptions.options = options || {
		projectName: "Test Lib",
		pattern: "/**/*.js",
		rootProject: {
			metadata: {
				name: "myname"
			},
			version: "1.33.7"
		}
	};
	return oOptions;
}


async function assertCreatedVersionInfoAndCreateOptions(t, oExpectedVersionInfo, options) {
	const oOptions = await createOptions(t, options);
	await assertCreatedVersionInfo(t, oExpectedVersionInfo, oOptions);
}

async function assertCreatedVersionInfo(t, oExpectedVersionInfo, oOptions) {
	await generateVersionInfo(oOptions);

	const resource = await oOptions.workspace.byPath("/resources/sap-ui-version.json");
	if (!resource) {
		t.fail("Could not find /resources/sap-ui-version.json in target");
		return;
	}

	const buffer = await resource.getBuffer();
	const currentVersionInfo = JSON.parse(buffer);

	t.is(currentVersionInfo.buildTimestamp.length, 12, "Timestamp should have length of 12 (yyyyMMddHHmm)");

	delete currentVersionInfo.buildTimestamp; // removing to allow deep comparison
	currentVersionInfo.libraries.forEach((lib) => {
		t.is(lib.buildTimestamp.length, 12, "Timestamp should have length of 12 (yyyyMMddHHmm)");
		delete lib.buildTimestamp; // removing to allow deep comparison
	});

	currentVersionInfo.libraries.sort((libraryA, libraryB) => {
		return libraryA.name.localeCompare(libraryB.name);
	});

	t.deepEqual(currentVersionInfo, oExpectedVersionInfo, "Correct content");
}

test("integration: Library without i18n bundle file", async (t) => {
	t.context.workspace = createWorkspace();
	t.context.dependencies = createDependencies();

	t.context.resources = [];
	t.context.resources.push(resourceFactory.createResource({
		path: "/resources/test/lib/.library",
		string: `
			<?xml version="1.0" encoding="UTF-8" ?>
			<library xmlns="http://www.sap.com/sap.ui.library.xsd" >

				<name>test.lib</name>
				<vendor>SAP SE</vendor>
				<copyright></copyright>
				<version>2.0.0</version>

				<documentation>Test Lib</documentation>

			</library>
		`,
		project: t.context.workspace._project
	}));

	await assertCreatedVersionInfoAndCreateOptions(t, {
		"libraries": [{
			"name": "test.lib3",
			"scmRevision": "",
			"version": "3.0.0"
		}],
		"name": "myname",
		"scmRevision": "",
		"version": "1.33.7",
	});
});

test("integration: Library without i18n bundle file failure", async (t) => {
	t.context.workspace = createWorkspace();
	t.context.dependencies = createDependencies();

	t.context.resources = [];
	t.context.resources.push(resourceFactory.createResource({
		path: "/resources/test/lib/.library",
		string: `
			<?xml version="1.0" encoding="UTF-8" ?>
			<library xmlns="http://www.sap.com/sap.ui.library.xsd" >

				<name>test.lib</name>
				<vendor>SAP SE</vendor>
				<copyright></copyright>
				<version>2.0.0</version>

				<documentation>Test Lib</documentation>

			</library>
		`,
		project: t.context.workspace._project
	}));

	const options = {
		projectName: "Test Lib",
		pattern: "/**/*.js",
		rootProject: {
			metadata: {
				name: "myname"
			}
		}
	};


	const oOptions = await createOptions(t, options);
	await generateVersionInfo(oOptions).catch((error) => {
		t.is(error.message, "[versionInfoGenerator]: Missing options parameters");
	});
});

const createProjectMetadata = (nameArray) => {
	return {
		metadata: {
			name: nameArray.join("."),
			namespace: nameArray.join("/")
		}
	};
};

const createManifestResource = async (dependencies, resourceFactory, names, deps, embeds) => {
	const content = {
		"sap.app": {
			"id": names.join("."),
			"embeds": []
		},
		"sap.ui5": {
			"dependencies": {
				"minUI5Version": "1.84",
				"libs": {}
			}
		}
	};

	const libs = {};
	deps.forEach((dep) => {
		libs[dep.name] = {
			"minVersion": "1.84.0"
		};
		if (dep.lazy) {
			libs[dep.name].lazy = true;
		}
	});
	content["sap.ui5"]["dependencies"]["libs"] = libs;
	if (embeds) {
		content["sap.app"]["embeds"] = embeds;
	}
	await dependencies.write(resourceFactory.createResource({
		path: `/resources/${names.join("/")}/manifest.json`,
		string: JSON.stringify(content, null, 2),
		project: createProjectMetadata(names)
	}));
};

async function createDotLibrary(dependencies, resourceFactory, names) {
	await dependencies.write(resourceFactory.createResource({
		path: `/resources/${names.join("/")}/.library`,
		string: `
			<?xml version="1.0" encoding="UTF-8" ?>
			<library xmlns="http://www.sap.com/sap.ui.library.xsd" >
				<name>${names.join(".")}</name>
				<vendor>SAP SE</vendor>
				<copyright></copyright>
				<version>2.0.0</version>

				<documentation>Library ${names.slice(1).join(".").toUpperCase()}</documentation>
			</library>
		`,
		project: createProjectMetadata(names)
	}));
}

/**
 *
 * @param {object} dependencies
 * @param {object} resourceFactory
 * @param {string[]} names
 * @param {object[]} deps
 * @param {string[]} [embeds]
 */
const createResources = async (dependencies, resourceFactory, names, deps, embeds) => {
	await createDotLibrary(dependencies, resourceFactory, names);
	await createManifestResource(dependencies, resourceFactory, names, deps, embeds);
};


test("integration: Library without i18n bundle with manifest minimal", async (t) => {
	const workspace = createWorkspace();

	// only use .library
	await createDotLibrary(workspace, resourceFactory, ["test", "lib"]);


	// input
	// lib.a => lib.c, lib.b
	// lib.b => lib.c (true)
	// lib.c => lib.d
	// lib.d =>

	// lib.a.sub.fold => lib.c

	// outcome
	// lib.a => lib.c, lib.b, lib.d
	// lib.b => lib.c (true), lib.d (true)
	// lib.c => lib.d
	// lib.d =>

	// dependencies

	const dependencies = createDependencies({virBasePath: "/"});

	// lib.a
	const embeds = ["sub/fold"];
	await createResources(dependencies, resourceFactory, ["lib", "a"], [{name: "lib.b"}, {name: "lib.c"}], embeds);
	// sub
	await createManifestResource(dependencies, resourceFactory, ["lib", "a", "sub", "fold"], [{name: "lib.c"}]);

	// lib.b
	await createResources(dependencies, resourceFactory, ["lib", "b"], [{name: "lib.c", lazy: true}]);

	// lib.c
	await createResources(dependencies, resourceFactory, ["lib", "c"], [{name: "lib.d"}]);

	// lib.d
	await createResources(dependencies, resourceFactory, ["lib", "d"], [{name: "lib.e", lazy: true}]);
	// lib.e
	await createResources(dependencies, resourceFactory, ["lib", "e"], []);

	const oOptions = {
		options: {
			projectName: "Test Lib",
			pattern: "/resources/**/.library",
			rootProject: {
				metadata: {
					name: "myname"
				},
				version: "1.33.7"
			}
		},
		workspace,
		dependencies
	};
	await assertCreatedVersionInfo(t, {
		"components": {
			"lib.a.sub.fold": {
				"library": "lib.a",
				"manifestHints": {
					"dependencies": {
						"libs": {
							"lib.c": {},
							"lib.d": {},
							"lib.e": {
								"lazy": true
							}
						}
					}
				}
			}
		},
		"libraries": [{
			"manifestHints": {
				"dependencies": {
					"libs": {
						"lib.b": {},
						"lib.c": {},
						"lib.d": {},
						"lib.e": {
							"lazy": true
						}
					}
				}
			},
			"name": "lib.a",
			"scmRevision": "",
		},
		{
			"manifestHints": {
				"dependencies": {
					"libs": {
						"lib.c": {
							"lazy": true
						},
						"lib.d": {
							"lazy": true
						},
						"lib.e": {
							"lazy": true
						}
					}
				}
			},
			"name": "lib.b",
			"scmRevision": "",
		},
		{
			"manifestHints": {
				"dependencies": {
					"libs": {
						"lib.d": {},
						"lib.e": {
							"lazy": true
						}
					}
				}
			},
			"name": "lib.c",
			"scmRevision": "",
		},
		{
			"manifestHints": {
				"dependencies": {
					"libs": {
						"lib.e": {
							"lazy": true
						}
					}
				}
			},
			"name": "lib.d",
			"scmRevision": "",
		},
		{
			"name": "lib.e",
			"scmRevision": "",
		}],
		"name": "myname",
		"scmRevision": "",
		"version": "1.33.7",
	}, oOptions);
});

test("integration: Library without i18n bundle with manifest minimal1", async (t) => {
	const workspace = createWorkspace();

	await createDotLibrary(workspace, resourceFactory, ["test", "lib"]);

	// input
	// lib.a => lib.c, lib.b
	// lib.b => lib.c (true)
	// lib.c => lib.d
	// lib.d =>

	// lib.a.sub.fold => lib.c

	// outcome
	// lib.a => lib.c, lib.b, lib.d
	// lib.b => lib.c (true), lib.d (true)
	// lib.c => lib.d
	// lib.d =>

	// dependencies

	const dependencies = createDependencies({virBasePath: "/"});

	// lib.a
	const embeds = ["sub/fold"];
	await createResources(dependencies, resourceFactory, ["lib", "a"],
		[{name: "lib.b"}, {name: "lib.c"}, {name: "lib.e"}], embeds);
	// sub
	await createManifestResource(dependencies, resourceFactory,
		["lib", "a", "sub", "fold"], [{name: "lib.c"}]);

	// lib.b
	await createResources(dependencies, resourceFactory, ["lib", "b"], [{name: "lib.c", lazy: true}]);

	// lib.c
	await createResources(dependencies, resourceFactory, ["lib", "c"], [{name: "lib.d"}]);

	// lib.d
	await createResources(dependencies, resourceFactory, ["lib", "d"], [{name: "lib.e", lazy: true}]);
	// lib.e
	await createResources(dependencies, resourceFactory, ["lib", "e"], []);

	const oOptions = {
		options: {
			projectName: "Test Lib",
			pattern: "/resources/**/.library",
			rootProject: {
				metadata: {
					name: "myname"
				},
				version: "1.33.7"
			}
		},
		workspace,
		dependencies
	};
	await assertCreatedVersionInfo(t, {
		"components": {
			"lib.a.sub.fold": {
				"library": "lib.a",
				"manifestHints": {
					"dependencies": {
						"libs": {
							"lib.c": {},
							"lib.d": {},
							"lib.e": {
								"lazy": true
							}
						}
					}
				}
			}
		},
		"libraries": [{
			"manifestHints": {
				"dependencies": {
					"libs": {
						"lib.b": {},
						"lib.c": {},
						"lib.d": {},
						"lib.e": {}
					}
				}
			},
			"name": "lib.a",
			"scmRevision": "",
		},
		{
			"manifestHints": {
				"dependencies": {
					"libs": {
						"lib.c": {
							"lazy": true
						},
						"lib.d": {
							"lazy": true
						},
						"lib.e": {
							"lazy": true
						}
					}
				}
			},
			"name": "lib.b",
			"scmRevision": "",
		},
		{
			"manifestHints": {
				"dependencies": {
					"libs": {
						"lib.d": {},
						"lib.e": {
							"lazy": true
						}
					}
				}
			},
			"name": "lib.c",
			"scmRevision": "",
		},
		{
			"manifestHints": {
				"dependencies": {
					"libs": {
						"lib.e": {
							"lazy": true
						}
					}
				}
			},
			"name": "lib.d",
			"scmRevision": "",
		},
		{
			"name": "lib.e",
			"scmRevision": "",
		}],
		"name": "myname",
		"scmRevision": "",
		"version": "1.33.7",
	}, oOptions);
});

test("integration: Library without i18n bundle with manifest minimal2", async (t) => {
	const workspace = createWorkspace();

	await createDotLibrary(workspace, resourceFactory, ["test", "lib"]);

	// input
	// lib.a => lib.c, lib.b
	// lib.b => lib.c (true)
	// lib.c => lib.d
	// lib.d =>

	// lib.a.sub.fold => lib.c

	// outcome
	// lib.a => lib.c, lib.b, lib.d
	// lib.b => lib.c (true), lib.d (true)
	// lib.c => lib.d
	// lib.d =>

	// dependencies

	const dependencies = createDependencies({virBasePath: "/"});

	// lib.a
	const embeds = ["sub/fold"];
	await createResources(dependencies, resourceFactory, ["lib", "a"], [{name: "lib.b"}, {name: "lib.c"}], embeds);
	// sub
	await createManifestResource(dependencies, resourceFactory, ["lib", "a", "sub", "fold"], [{name: "lib.c"}]);

	// lib.b
	await createResources(dependencies, resourceFactory, ["lib", "b"], [{name: "lib.c", lazy: true}]);

	// lib.c
	await createResources(dependencies, resourceFactory, ["lib", "c"], [{name: "lib.d"}]);

	// lib.d
	await createResources(dependencies, resourceFactory, ["lib", "d"], [{name: "lib.e"}]);
	// lib.e
	await createResources(dependencies, resourceFactory, ["lib", "e"], []);

	const oOptions = {
		options: {
			projectName: "Test Lib",
			pattern: "/resources/**/.library",
			rootProject: {
				metadata: {
					name: "myname"
				},
				version: "1.33.7"
			}
		},
		workspace,
		dependencies
	};
	await assertCreatedVersionInfo(t, {
		"components": {
			"lib.a.sub.fold": {
				"library": "lib.a",
				"manifestHints": {
					"dependencies": {
						"libs": {
							"lib.c": {},
							"lib.d": {},
							"lib.e": {}
						}
					}
				}
			}
		},
		"libraries": [{
			"manifestHints": {
				"dependencies": {
					"libs": {
						"lib.b": {},
						"lib.c": {},
						"lib.d": {},
						"lib.e": {},
					}
				}
			},
			"name": "lib.a",
			"scmRevision": "",
		},
		{
			"manifestHints": {
				"dependencies": {
					"libs": {
						"lib.c": {
							"lazy": true
						},
						"lib.d": {
							"lazy": true
						},
						"lib.e": {
							"lazy": true
						}
					}
				}
			},
			"name": "lib.b",
			"scmRevision": "",
		},
		{
			"manifestHints": {
				"dependencies": {
					"libs": {
						"lib.d": {},
						"lib.e": {}
					}
				}
			},
			"name": "lib.c",
			"scmRevision": "",
		},
		{
			"manifestHints": {
				"dependencies": {
					"libs": {
						"lib.e": {}
					}
				}
			},
			"name": "lib.d",
			"scmRevision": "",
		},
		{
			"name": "lib.e",
			"scmRevision": "",
		}],
		"name": "myname",
		"scmRevision": "",
		"version": "1.33.7",
	}, oOptions);
});


test("integration: Library without i18n bundle with manifest simple", async (t) => {
	const workspace = createWorkspace();

	await createDotLibrary(workspace, resourceFactory, ["test", "lib"]);


	// lib.a => lib.c, lib.b
	// lib.b => lib.c (true)
	// lib.c =>

	// lib.a => lib.c, lib.b
	// lib.b => lib.c (true)
	// lib.c =>

	// dependencies

	const dependencies = createDependencies({virBasePath: "/"});

	// lib.a
	const embeds = ["sub/fold"];
	await createResources(dependencies, resourceFactory, ["lib", "a"], [{name: "lib.b"}, {name: "lib.c"}], embeds);
	// sub
	await createManifestResource(dependencies, resourceFactory, ["lib", "a", "sub", "fold"], [{name: "lib.c"}]);

	// lib.c
	await createResources(dependencies, resourceFactory, ["lib", "c"], [{name: "lib.b", lazy: true}]);

	// lib.b
	await createResources(dependencies, resourceFactory, ["lib", "b"], []);

	const oOptions = {
		options: {
			projectName: "Test Lib",
			pattern: "/resources/**/.library",
			rootProject: {
				metadata: {
					name: "myname"
				},
				version: "1.33.7"
			}
		},
		workspace,
		dependencies
	};
	await assertCreatedVersionInfo(t, {
		"components": {
			"lib.a.sub.fold": {
				"library": "lib.a",
				"manifestHints": {
					"dependencies": {
						"libs": {
							"lib.b": {
								"lazy": true
							},
							"lib.c": {}
						}
					}
				}
			}
		},
		"libraries": [{
			"manifestHints": {
				"dependencies": {
					"libs": {
						"lib.b": {},
						"lib.c": {}
					}
				}
			},
			"name": "lib.a",
			"scmRevision": "",
		},
		{
			"name": "lib.b",
			"scmRevision": "",
		},
		{
			"manifestHints": {
				"dependencies": {
					"libs": {
						"lib.b": {
							"lazy": true
						}
					}
				}
			},
			"name": "lib.c",
			"scmRevision": "",
		}],
		"name": "myname",
		"scmRevision": "",
		"version": "1.33.7",
	}, oOptions);
});

test("integration: Library without i18n bundle with manifest house sample", async (t) => {
	// top level libraries

	// lib.house => lib.roof, lib.walls
	// lib.walls => lib.baseplate
	// lib.roof => lib.land, lib.walls (true)
	// lib.baseplate => lib.land (true)
	// lib.land =>

	// lib.house => lib.roof, lib.walls, lib.baseplate, lib.land (true)
	// lib.walls => lib.baseplate, lib.land (true)
	// lib.roof => lib.walls (true), lib.land, lib.baseplate (true)
	// lib.baseplate => lib.land (true)
	// lib.land =>
	//

	const workspace = createWorkspace();

	await createDotLibrary(workspace, resourceFactory, ["test", "lib"]);


	// dependencies
	const dependencies = createDependencies({virBasePath: "/"});

	// lib.house
	const embeds = ["garden"];
	await createResources(dependencies, resourceFactory, ["lib", "house"],
		[{name: "lib.roof"}, {name: "lib.walls"}], embeds);
	// sub garden
	await createManifestResource(dependencies, resourceFactory, ["lib", "house", "garden"], [{name: "lib.baseplate"}]);

	// lib.roof
	await createResources(dependencies, resourceFactory, ["lib", "roof"],
		[{name: "lib.land"}, {name: "lib.walls", lazy: true}]);

	// lib.walls
	await createResources(dependencies, resourceFactory, ["lib", "walls"], [{name: "lib.baseplate"}]);

	// lib.baseplate
	await createResources(dependencies, resourceFactory, ["lib", "baseplate"], [{name: "lib.land", lazy: true}]);

	// lib.land
	await createResources(dependencies, resourceFactory, ["lib", "land"], []);

	const oOptions = {
		options: {
			projectName: "Test Lib",
			pattern: "/resources/**/.library",
			rootProject: {
				metadata: {
					name: "myname"
				},
				version: "1.33.7"
			}
		},
		workspace,
		dependencies
	};
	await assertCreatedVersionInfo(t, {
		"components": {
			"lib.house.garden": {
				"library": "lib.house",
				"manifestHints": {
					"dependencies": {
						"libs": {
							"lib.baseplate": {},
							"lib.land": {
								"lazy": true
							}
						}
					}
				}
			}
		},
		"libraries": [
			{
				"manifestHints": {
					"dependencies": {
						"libs": {
							"lib.land": {
								lazy: true
							}
						}
					}
				},
				"name": "lib.baseplate",
				"scmRevision": "",
			},
			{
				"manifestHints": {
					"dependencies": {
						"libs": {
							"lib.walls": {},
							"lib.baseplate": {},
							"lib.roof": {},
							"lib.land": {}
						}
					}
				},
				"name": "lib.house",
				"scmRevision": "",
			},
			{
				"name": "lib.land",
				"scmRevision": "",
			},
			{
				"manifestHints": {
					"dependencies": {
						"libs": {
							"lib.land": {},
							"lib.baseplate": {
								lazy: true
							},
							"lib.walls": {
								lazy: true
							}
						}
					}
				},
				"name": "lib.roof",
				"scmRevision": "",
			},
			{
				"manifestHints": {
					"dependencies": {
						"libs": {
							"lib.baseplate": {},
							"lib.land": {
								lazy: true
							}
						}
					}
				},
				"name": "lib.walls",
				"scmRevision": "",
			}
		],
		"name": "myname",
		"scmRevision": "",
		"version": "1.33.7",
	}, oOptions);
});
