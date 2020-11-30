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
	// lib.b => lib.d
	// lib.c => lib.e, lib.b (true)
	// lib.d => lib.e (true)
	// lib.e =>

	// lib.b => lib.d, lib.e (true)
	// lib.c =>
	// lib.a => lib.c, lib.b, lib.d, lib.e (true)
	// lib.d => lib.e (true)
	// lib.e =>

	await workspace.write(resourceFactory.createResource({
		path: "/resources/test/lib/subcomp/manifest.json",
		string: `
			{
				"sap.app": {
					"embeds": []
				},
				"sap.ui5": {
				    "dependencies": {
				      "minUI5Version": "1.84",
				      "libs": {
				        "libY": {
				          "minVersion": "1.84.0"
				        },
				        "libX": {
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
					"embeds": []
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
		"components": [],
		"libraries": [{
			"manifestHints": {
				"dependencies": {
					"libs": {
						"lib.b": {},
						"lib.d": {},
						"lib.c": {}
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
						"lib.d": {}
					}
				}
			},
			"name": "lib.b",
			"scmRevision": "",
		},
		{
			"name": "lib.c",
			"scmRevision": "",
		},
		{
			"manifestHints": {
				"dependencies": {
					"libs": {
						"lib.e": {
							lazy: true
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

test("integration: Library without i18n bundle with manifest max", async (t) => {
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
	// lib.b => lib.d
	// lib.c => lib.e, lib.b (true)
	// lib.d => lib.e (true)
	// lib.e =>

	// lib.b => lib.d, lib.e (true)
	// lib.c =>
	// lib.a => lib.c, lib.b, lib.d, lib.e (true)
	// lib.d => lib.e (true)
	// lib.e =>

	await workspace.write(resourceFactory.createResource({
		path: "/resources/test/lib/subcomp/manifest.json",
		string: `
			{
				"sap.app": {
					"embeds": []
				},
				"sap.ui5": {
				    "dependencies": {
				      "minUI5Version": "1.84",
				      "libs": {
				        "libY": {
				          "minVersion": "1.84.0"
				        },
				        "libX": {
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
					"embeds": []
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
				        "lib.e": {
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
				        "lib.d": {
				          "minVersion": "1.84.0"
				        }
				      }
				    }
				}
			}
		`,
		project: createProjectMetadata(["lib", "b"])
	}));

	// lib.d
	await dependencies.write(resourceFactory.createResource({
		path: "/resources/lib/d/.library",
		string: `
			<?xml version="1.0" encoding="UTF-8" ?>
			<library xmlns="http://www.sap.com/sap.ui.library.xsd" >
				<name>lib.d</name>
				<vendor>SAP SE</vendor>
				<copyright></copyright>
				<version>2.0.0</version>

				<documentation>Library D</documentation>
			</library>
		`,
		project: createProjectMetadata(["lib", "d"])
	}));
	await dependencies.write(resourceFactory.createResource({
		path: "/resources/lib/d/manifest.json",
		string: `
			{
				"sap.app": {
					"embeds": []
				},
				"sap.ui5": {
				    "dependencies": {
				      "minUI5Version": "1.84",
				      "libs": {
					      "lib.e": {
					          "minVersion": "1.84.0",
					          "lazy": true
					        }
				      }
				    }
				}
			}
		`,
		project: createProjectMetadata(["lib", "d"])
	}));

	// lib.e
	await dependencies.write(resourceFactory.createResource({
		path: "/resources/lib/e/.library",
		string: `
			<?xml version="1.0" encoding="UTF-8" ?>
			<library xmlns="http://www.sap.com/sap.ui.library.xsd" >
				<name>lib.e</name>
				<vendor>SAP SE</vendor>
				<copyright></copyright>
				<version>2.0.0</version>

				<documentation>Library E</documentation>
			</library>
		`,
		project: createProjectMetadata(["lib", "e"])
	}));
	await dependencies.write(resourceFactory.createResource({
		path: "/resources/lib/e/manifest.json",
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
		project: createProjectMetadata(["lib", "e"])
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
		"components": [],
		"libraries": [{
			"manifestHints": {
				"dependencies": {
					"libs": {
						"lib.b": {},
						"lib.d": {},
						"lib.c": {},
						"lib.e": {
							lazy: true
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
							"lib.d": {},
							"lib.e": {
								lazy: true
							}
						}
					}
				},
				"name": "lib.b",
				"scmRevision": "",
			},
			{
				"name": "lib.c",
				"scmRevision": "",
			},
			{
				"manifestHints": {
					"dependencies": {
						"libs": {
							"lib.e": {
								lazy: true
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
