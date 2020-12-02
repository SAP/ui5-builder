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

function createDependencies() {
	return resourceFactory.createAdapter({
		fsBasePath: path.join(__dirname, "..", "..", "fixtures", "sap.ui.core-evo", "main", "src"),
		virBasePath: "/resources",
		project: {
			metadata: {
				name: "test.lib3"
			},
			version: "3.0.0"}
	});
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


test("integration: Library without i18n bundle with manifest", async (t) => {
	const workspace = resourceFactory.createAdapter({
		virBasePath: "/",
		project: {
			metadata: {
				name: "test.lib",
				namespace: "test/lib"
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

	// TODO .library should not be required
	// only use .library if manifest.json is not there
	await workspace.write(resourceFactory.createResource({
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
		project: workspace._project
	}));

	await workspace.write(resourceFactory.createResource({
		path: "/resources/test/lib/manifest.json",
		string: `
			{
				"sap.app": {
					"embeds": ["subcomp"]
				},
				"sap.ui5": {
				    "dependencies": {
				      "minUI5Version": "1.84",
				      "libs": {
				        "lib.a": {
				          "minVersion": "1.84.0"
				        },
				        "lib.b": {
				          "minVersion": "1.84.0",
				          "lazy": true
				        }
				      }
				    }
				}
			}
		`,
		project: workspace._project
	}));

	// lib.a => lib.c, lib.b
	// lib.b => lib.c (true)
	// lib.c =>

	// lib.a => lib.c, lib.b
	// lib.b => lib.c (true)
	// lib.c =>

	// dependencies
	const createProjectMetadata = (nameArray) => {
		return {
			metadata: {
				name: nameArray.join("."),
				namespace: nameArray.join("/")
			}
		};
	};
	const dependencies = resourceFactory.createAdapter({
		virBasePath: "/",
		project: {
			metadata: {
				name: "lib.a",
				namespace: "lib/a"
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

	// lib.a
	await dependencies.write(resourceFactory.createResource({
		path: "/resources/lib/a/.library",
		string: `
			<?xml version="1.0" encoding="UTF-8" ?>
			<library xmlns="http://www.sap.com/sap.ui.library.xsd" >
				<name>lib.a</name>
				<vendor>SAP SE</vendor>
				<copyright></copyright>
				<version>2.0.0</version>

				<documentation>Library A</documentation>
			</library>
		`,
		project: createProjectMetadata(["lib", "a"])
	}));
	await dependencies.write(resourceFactory.createResource({
		path: "/resources/lib/a/manifest.json",
		string: `
			{
				"sap.app": {
					"embeds": ["sub/fold"]
				},
				"sap.ui5": {
				    "dependencies": {
				      "minUI5Version": "1.84",
				      "libs": {
				        "lib.c": {
				          "minVersion": "1.84.0"
				        },
				        "lib.b": {
				            "minVersion": "1.84.0"
				        }
				      }
				    }
				}
			}
		`,
		project: createProjectMetadata(["lib", "a"])
	}));

	// sub
	await dependencies.write(resourceFactory.createResource({
		path: "/resources/lib/a/sub/fold/manifest.json",
		string: `
			{
				"sap.app": {
					"id": "lib.a.sub.fold",
					"embeds": []
				},
				"sap.ui5": {
				    "dependencies": {
				      "minUI5Version": "1.84",
				      "libs": {
				        "lib.c": {
				          "minVersion": "1.84.0"
				        }
				      }
				    }
				}
			}
		`,
		project: createProjectMetadata(["lib", "a", "sub", "fold"])
	}));

	// lib.c
	await dependencies.write(resourceFactory.createResource({
		path: "/resources/lib/c/.library",
		string: `
			<?xml version="1.0" encoding="UTF-8" ?>
			<library xmlns="http://www.sap.com/sap.ui.library.xsd" >
				<name>lib.c</name>
				<vendor>SAP SE</vendor>
				<copyright></copyright>
				<version>2.0.0</version>

				<documentation>Library C</documentation>
			</library>
		`,
		project: createProjectMetadata(["lib", "c"])
	}));
	await dependencies.write(resourceFactory.createResource({
		path: "/resources/lib/c/manifest.json",
		string: `
			{
				"sap.app": {
					"embeds": []
				},
				"sap.ui5": {
				    "dependencies": {
				      "minUI5Version": "1.84",
				      "libs": {
				        "lib.b": {
				          "minVersion": "1.84.0",
				          "lazy": true
				        }
				      }
				    }
				}
			}
		`,
		project: createProjectMetadata(["lib", "c"])
	}));

	// lib.b
	await dependencies.write(resourceFactory.createResource({
		path: "/resources/lib/b/.library",
		string: `
			<?xml version="1.0" encoding="UTF-8" ?>
			<library xmlns="http://www.sap.com/sap.ui.library.xsd" >
				<name>lib.b</name>
				<vendor>SAP SE</vendor>
				<copyright></copyright>
				<version>2.0.0</version>

				<documentation>Library B</documentation>
			</library>
		`,
		project: createProjectMetadata(["lib", "b"])
	}));
	await dependencies.write(resourceFactory.createResource({
		path: "/resources/lib/b/manifest.json",
		string: `
			{
				"sap.app": {
					"embeds": []
				},
				"sap.ui5": {
				    "dependencies": {
				      "minUI5Version": "1.84",
				      "libs": {
				      }
				    }
				}
			}
		`,
		project: createProjectMetadata(["lib", "b"])
	}));


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

test("integration: Library without i18n bundle with manifest max", async (t) => {
	// top level libraries


	// haus (a) => dach (c), Wände (b)
	// Wände (b) => grundplatte (d)
	// grundplatte (d) => grundstück (e)
	// dach (c) => wände (b), grundstück(e)
	// grundstück (e) =>

	// lib.house => lib.roof, lib.walls
	// lib.walls => lib.baseplate
	// lib.roof => lib.land, lib.walls (true)
	// lib.baseplate => lib.land (true)
	// lib.land =>

	// lib.house => lib.roof, lib.walls, lib.baseplate, lib.land (true)
	// lib.walls => lib.baseplate, lib.land (true)
	// lib.roof => lib.walls, lib.land
	// lib.baseplate => lib.land (true)
	// lib.land =>
	//

	const workspace = resourceFactory.createAdapter({
		virBasePath: "/",
		project: {
			metadata: {
				name: "test.lib",
				namespace: "test/lib"
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

	// TODO .library should not be required
	// only use .library if manifest.json is not there
	await workspace.write(resourceFactory.createResource({
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
		project: workspace._project
	}));

	await workspace.write(resourceFactory.createResource({
		path: "/resources/test/lib/manifest.json",
		string: `
			{
				"sap.app": {
					"embeds": []
				},
				"sap.ui5": {
				    "dependencies": {
				      "minUI5Version": "1.84",
				      "libs": {
				        "lib.house": {
				          "minVersion": "1.84.0"
				        },
				        "lib.walls": {
				          "minVersion": "1.84.0",
				          "lazy": true
				        }
				      }
				    }
				}
			}
		`,
		project: workspace._project
	}));

	// dependencies
	const createProjectMetadata = (nameArray) => {
		return {
			metadata: {
				name: nameArray.join("."),
				namespace: nameArray.join("/")
			}
		};
	};
	const dependencies = resourceFactory.createAdapter({
		virBasePath: "/",
		project: {
			metadata: {
				name: "lib.house",
				namespace: "lib/house"
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

	// lib.house
	await dependencies.write(resourceFactory.createResource({
		path: "/resources/lib/house/.library",
		string: `
			<?xml version="1.0" encoding="UTF-8" ?>
			<library xmlns="http://www.sap.com/sap.ui.library.xsd" >
				<name>lib.house</name>
				<vendor>SAP SE</vendor>
				<copyright></copyright>
				<version>2.0.0</version>

				<documentation>Library House</documentation>
			</library>
		`,
		project: createProjectMetadata(["lib", "house"])
	}));
	await dependencies.write(resourceFactory.createResource({
		path: "/resources/lib/house/manifest.json",
		string: `
			{
				"sap.app": {
					"embeds": ["garden"]
				},
				"sap.ui5": {
				    "dependencies": {
				      "minUI5Version": "1.84",
				      "libs": {
				        "lib.roof": {
				          "minVersion": "1.84.0"
				        },
				        "lib.walls": {
				            "minVersion": "1.84.0"
				        }
				      }
				    }
				}
			}
		`,
		project: createProjectMetadata(["lib", "house"])
	}));

	await dependencies.write(resourceFactory.createResource({
		path: "/resources/lib/house/garden/manifest.json",
		string: `
			{
				"sap.app": {
					"embeds": [],
					"id": "lib.house.garden"
				},
				"sap.ui5": {
				    "dependencies": {
				      "minUI5Version": "1.84",
				      "libs": {
				        "lib.baseplate": {
				          "minVersion": "1.84.0"
				        }
				      }
				    }
				}
			}
		`,
		project: createProjectMetadata(["lib", "house", "garden"])
	}));

	// lib.roof
	await dependencies.write(resourceFactory.createResource({
		path: "/resources/lib/roof/.library",
		string: `
			<?xml version="1.0" encoding="UTF-8" ?>
			<library xmlns="http://www.sap.com/sap.ui.library.xsd" >
				<name>lib.roof</name>
				<vendor>SAP SE</vendor>
				<copyright></copyright>
				<version>2.0.0</version>

				<documentation>Library Roof</documentation>
			</library>
		`,
		project: createProjectMetadata(["lib", "roof"])
	}));
	await dependencies.write(resourceFactory.createResource({
		path: "/resources/lib/roof/manifest.json",
		string: `
			{
				"sap.app": {
					"embeds": []
				},
				"sap.ui5": {
				    "dependencies": {
				      "minUI5Version": "1.84",
				      "libs": {
				        "lib.land": {
				          "minVersion": "1.84.0"
				        },
				        "lib.walls": {
				          "minVersion": "1.84.0",
				          "lazy": true
				        }
				      }
				    }
				}
			}
		`,
		project: createProjectMetadata(["lib", "roof"])
	}));

	// lib.walls
	await dependencies.write(resourceFactory.createResource({
		path: "/resources/lib/walls/.library",
		string: `
			<?xml version="1.0" encoding="UTF-8" ?>
			<library xmlns="http://www.sap.com/sap.ui.library.xsd" >
				<name>lib.walls</name>
				<vendor>SAP SE</vendor>
				<copyright></copyright>
				<version>2.0.0</version>

				<documentation>Library B</documentation>
			</library>
		`,
		project: createProjectMetadata(["lib", "walls"])
	}));
	await dependencies.write(resourceFactory.createResource({
		path: "/resources/lib/walls/manifest.json",
		string: `
			{
				"sap.app": {
					"embeds": []
				},
				"sap.ui5": {
				    "dependencies": {
				      "minUI5Version": "1.84",
				      "libs": {
				        "lib.baseplate": {
				          "minVersion": "1.84.0"
				        }
				      }
				    }
				}
			}
		`,
		project: createProjectMetadata(["lib", "walls"])
	}));

	// lib.baseplate
	await dependencies.write(resourceFactory.createResource({
		path: "/resources/lib/baseplate/.library",
		string: `
			<?xml version="1.0" encoding="UTF-8" ?>
			<library xmlns="http://www.sap.com/sap.ui.library.xsd" >
				<name>lib.baseplate</name>
				<vendor>SAP SE</vendor>
				<copyright></copyright>
				<version>2.0.0</version>

				<documentation>Library Baseplate</documentation>
			</library>
		`,
		project: createProjectMetadata(["lib", "baseplate"])
	}));
	await dependencies.write(resourceFactory.createResource({
		path: "/resources/lib/baseplate/manifest.json",
		string: `
			{
				"sap.app": {
					"embeds": []
				},
				"sap.ui5": {
				    "dependencies": {
				      "minUI5Version": "1.84",
				      "libs": {
					      "lib.land": {
					          "minVersion": "1.84.0",
					          "lazy": true
					        }
				      }
				    }
				}
			}
		`,
		project: createProjectMetadata(["lib", "baseplate"])
	}));

	// lib.land
	await dependencies.write(resourceFactory.createResource({
		path: "/resources/lib/land/.library",
		string: `
			<?xml version="1.0" encoding="UTF-8" ?>
			<library xmlns="http://www.sap.com/sap.ui.library.xsd" >
				<name>lib.land</name>
				<vendor>SAP SE</vendor>
				<copyright></copyright>
				<version>2.0.0</version>

				<documentation>Library Land</documentation>
			</library>
		`,
		project: createProjectMetadata(["lib", "land"])
	}));
	await dependencies.write(resourceFactory.createResource({
		path: "/resources/lib/land/manifest.json",
		string: `
			{
				"sap.app": {
					"embeds": []
				},
				"sap.ui5": {
				    "dependencies": {
				      "minUI5Version": "1.84",
				      "libs": {
				      }
				    }
				}
			}
		`,
		project: createProjectMetadata(["lib", "land"])
	}));

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
							"lib.baseplate": {},
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
