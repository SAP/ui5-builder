import test from "ava";
import sinonGlobal from "sinon";
import esmock from "esmock";

test.beforeEach(async (t) => {
	const sinon = t.context.sinon = sinonGlobal.createSandbox();
	t.context.logWarnSpy = sinon.spy();
	t.context.logVerboseSpy = sinon.spy();
	t.context.logErrorSpy = sinon.spy();
	const loggerStub = {
		warn: t.context.logWarnSpy,
		verbose: t.context.logVerboseSpy,
		error: t.context.logErrorSpy
	};
	const manifestEnricherImport = await esmock("../../../lib/processors/manifestEnricher.js", {
		"@ui5/logger": {
			getLogger: sinon.stub().withArgs("builder:processors:manifestEnricher").returns(loggerStub)
		}
	});
	t.context.manifestEnricher = manifestEnricherImport.default;
	t.context.__internals__ = manifestEnricherImport.__internals__;

	t.context.fs = {
		readdir: sinon.stub().callsArgWith(1, null, [])
	};
});

test.afterEach.always((t) => {
	t.context.sinon.restore();
});


function createResource(path, bNamespaced, input, fnOnSetString) {
	return {
		getString: () => Promise.resolve(input),
		setString: fnOnSetString, // TODO: replace with sinon stub, move function to t.context
		getProject() {
			return {
				getNamespace() {
					const namespace = path.substring(0, path.lastIndexOf("/")).replace("/resources/", "");
					return bNamespaced ? namespace : "";
				}
			};
		},
		getPath() {
			return path;
		}
	};
}

// #######################################################
// Type: Application
// #######################################################

test("Application: No replacement (No properties files)", async (t) => {
	const {manifestEnricher, fs} = t.context;

	const input = JSON.stringify({
		"_version": "1.58.0",
		"sap.app": {
			"id": "sap.ui.demo.app",
			"type": "application"
		}
	}, null, 2);

	const resource = createResource("/resources/sap/ui/demo/app/manifest.json", true, input,
		(actual) => t.fail("setString should never be called because resource should not be changed"));

	const processedResources = await manifestEnricher({
		resources: [resource],
		fs
	});

	t.deepEqual(processedResources, [undefined], "No resource is returned, because it is not changed");

	t.true(t.context.logWarnSpy.notCalled, "No warnings should be logged");
	t.true(t.context.logErrorSpy.notCalled, "No errors should be logged");
});

test("Application: sap.app/i18n (with templates, default bundle): " +
	"Replaces supportedLocales with available properties files",
async (t) => {
	const {manifestEnricher, fs} = t.context;
	const input = JSON.stringify({
		"_version": "1.58.0",
		"sap.app": {
			"id": "sap.ui.demo.app",
			"type": "application",
			"title": "{{title}}"
		}
	}, null, 2);

	const expected = JSON.stringify({
		"_version": "1.58.0",
		"sap.app": {
			"id": "sap.ui.demo.app",
			"type": "application",
			"title": "{{title}}",
			"i18n": {
				"bundleUrl": "i18n/i18n.properties",
				"supportedLocales": ["de", "en"]
			}
		}
	}, null, 2);

	const resource = createResource("/resources/sap/ui/demo/app/manifest.json", true, input,
		(actual) => t.deepEqual(actual, expected, "Correct file content should be set"));

	fs.readdir.withArgs("/resources/sap/ui/demo/app/i18n")
		.callsArgWith(1, null, ["i18n_de.properties", "i18n_en.properties"]);

	const processedResources = await manifestEnricher({
		resources: [resource],
		fs
	});

	t.deepEqual(processedResources, [resource], "Input resource is returned");

	t.true(t.context.logWarnSpy.notCalled, "No warnings should be logged");
	t.true(t.context.logErrorSpy.notCalled, "No errors should be logged");
});

test("Application: sap.app/i18n (with templates, custom bundle): " +
	"Replaces supportedLocales with available properties files",
async (t) => {
	const {manifestEnricher, fs} = t.context;
	const input = JSON.stringify({
		"_version": "1.58.0",
		"sap.app": {
			"id": "sap.ui.demo.app",
			"type": "application",
			"title": "{{title}}",
			"i18n": "mybundle.properties"
		}
	}, null, 2);

	const expected = JSON.stringify({
		"_version": "1.58.0",
		"sap.app": {
			"id": "sap.ui.demo.app",
			"type": "application",
			"title": "{{title}}",
			"i18n": {
				"bundleUrl": "mybundle.properties",
				"supportedLocales": ["de", "en"]
			}
		}
	}, null, 2);

	const resource = createResource("/resources/sap/ui/demo/app/manifest.json", true, input,
		(actual) => t.deepEqual(actual, expected, "Correct file content should be set"));

	fs.readdir.withArgs("/resources/sap/ui/demo/app")
		.callsArgWith(1, null, ["mybundle_de.properties", "mybundle_en.properties"]);

	const processedResources = await manifestEnricher({
		resources: [resource],
		fs
	});

	t.deepEqual(processedResources, [resource], "Input resource is returned");

	t.true(t.context.logWarnSpy.notCalled, "No warnings should be logged");
	t.true(t.context.logErrorSpy.notCalled, "No errors should be logged");
});

test("Application: sap.ui5/models: " +
	"Replaces supportedLocales with available properties files",
async (t) => {
	const {manifestEnricher, fs} = t.context;
	const input = JSON.stringify({
		"_version": "1.58.0",
		"sap.app": {
			"id": "sap.ui.demo.app",
			"type": "application"
		},
		"sap.ui5": {
			"models": {
				"i18n": {
					"type": "sap.ui.model.resource.ResourceModel",
					"settings": {
						"bundleName": "sap.ui.demo.app.i18nModel.i18n",
						"fallbackLocale": "de"
					}
				}
			}
		}
	}, null, 2);

	const expected = JSON.stringify({
		"_version": "1.58.0",
		"sap.app": {
			"id": "sap.ui.demo.app",
			"type": "application"
		},
		"sap.ui5": {
			"models": {
				"i18n": {
					"type": "sap.ui.model.resource.ResourceModel",
					"settings": {
						"bundleName": "sap.ui.demo.app.i18nModel.i18n",
						"fallbackLocale": "de",
						"supportedLocales": ["de", "en"]
					}
				}
			}
		}
	}, null, 2);

	const resource = createResource("/resources/sap/ui/demo/app/manifest.json", true, input,
		(actual) => t.deepEqual(actual, expected, "Correct file content should be set"));

	fs.readdir.withArgs("/resources/sap/ui/demo/app/i18nModel")
		.callsArgWith(1, null, ["i18n_de.properties", "i18n_en.properties"]);

	const processedResources = await manifestEnricher({
		resources: [resource],
		fs
	});

	t.deepEqual(processedResources, [resource], "Input resource is returned");

	t.true(t.context.logWarnSpy.notCalled, "No warnings should be logged");
	t.true(t.context.logErrorSpy.notCalled, "No errors should be logged");
});

test("Application: sap.ui5/models (bundleUrl): " +
	"Replaces supportedLocales with available properties files",
async (t) => {
	const {manifestEnricher, fs} = t.context;
	const input = JSON.stringify({
		"_version": "1.58.0",
		"sap.app": {
			"id": "sap.ui.demo.app",
			"type": "application"
		},
		"sap.ui5": {
			"models": {
				"i18n": {
					"type": "sap.ui.model.resource.ResourceModel",
					"settings": {
						"bundleUrl": "i18nModel/i18n.properties",
						"fallbackLocale": "de"
					}
				}
			}
		}
	}, null, 2);

	const expected = JSON.stringify({
		"_version": "1.58.0",
		"sap.app": {
			"id": "sap.ui.demo.app",
			"type": "application"
		},
		"sap.ui5": {
			"models": {
				"i18n": {
					"type": "sap.ui.model.resource.ResourceModel",
					"settings": {
						"bundleUrl": "i18nModel/i18n.properties",
						"fallbackLocale": "de",
						"supportedLocales": ["de", "en"]
					}
				}
			}
		}
	}, null, 2);

	const resource = createResource("/resources/sap/ui/demo/app/manifest.json", true, input,
		(actual) => t.deepEqual(actual, expected, "Correct file content should be set"));

	fs.readdir.withArgs("/resources/sap/ui/demo/app/i18nModel")
		.callsArgWith(1, null, ["i18n_de.properties", "i18n_en.properties"]);

	const processedResources = await manifestEnricher({
		resources: [resource],
		fs
	});

	t.deepEqual(processedResources, [resource], "Input resource is returned");

	t.true(t.context.logWarnSpy.notCalled, "No warnings should be logged");
	t.true(t.context.logErrorSpy.notCalled, "No errors should be logged");
});

test("Application: sap.ui5/models (bundleUrl with ui5 protocol): " +
	"Replaces supportedLocales with available properties files",
async (t) => {
	const {manifestEnricher, fs} = t.context;
	const input = JSON.stringify({
		"_version": "1.58.0",
		"sap.app": {
			"id": "sap.ui.demo.app",
			"type": "application"
		},
		"sap.ui5": {
			"models": {
				"i18n": {
					"type": "sap.ui.model.resource.ResourceModel",
					"settings": {
						"bundleUrl": "ui5://sap/ui/demo/app/i18nModel/i18n.properties",
						"fallbackLocale": "de"
					}
				}
			}
		}
	}, null, 2);

	const expected = JSON.stringify({
		"_version": "1.58.0",
		"sap.app": {
			"id": "sap.ui.demo.app",
			"type": "application"
		},
		"sap.ui5": {
			"models": {
				"i18n": {
					"type": "sap.ui.model.resource.ResourceModel",
					"settings": {
						"bundleUrl": "ui5://sap/ui/demo/app/i18nModel/i18n.properties",
						"fallbackLocale": "de",
						"supportedLocales": ["de", "en"]
					}
				}
			}
		}
	}, null, 2);

	const resource = createResource("/resources/sap/ui/demo/app/manifest.json", true, input,
		(actual) => t.deepEqual(actual, expected, "Correct file content should be set"));

	fs.readdir.withArgs("/resources/sap/ui/demo/app/i18nModel")
		.callsArgWith(1, null, ["i18n_de.properties", "i18n_en.properties"]);

	const processedResources = await manifestEnricher({
		resources: [resource],
		fs
	});

	t.deepEqual(processedResources, [resource], "Input resource is returned");

	t.true(t.context.logWarnSpy.notCalled, "No warnings should be logged");
	t.true(t.context.logErrorSpy.notCalled, "No errors should be logged");
});

test("Application: sap.ui5/models: " +
	"Do not replace supportedLocales when supportedLocales are already defined",
async (t) => {
	const {manifestEnricher, fs} = t.context;
	const input = JSON.stringify({
		"_version": "1.58.0",
		"sap.app": {
			"id": "sap.ui.demo.app",
			"type": "application"
		},
		"sap.ui5": {
			"models": {
				"i18n": {
					"type": "sap.ui.model.resource.ResourceModel",
					"settings": {
						"bundleName": "sap.ui.demo.app.i18nModel.i18n",
						"supportedLocales": ["en", "fr"],
						"fallbackLocale": "fr"
					}
				}
			}
		}
	}, null, 2);

	const resource = createResource("/resources/sap/ui/demo/app/manifest.json", true, input,
		(actual) => t.fail("setString should never be called because resource should not be changed"));

	fs.readdir.withArgs("/resources/sap/ui/demo/app/i18nModel")
		.callsArgWith(1, null, ["i18n_de.properties", "i18n_en.properties"]);

	const processedResources = await manifestEnricher({
		resources: [resource],
		fs
	});

	t.deepEqual(processedResources, [undefined], "No resource is returned, because it is not changed");
	t.true(t.context.logWarnSpy.notCalled, "No warnings should be logged");
	t.true(t.context.logErrorSpy.notCalled, "No errors should be logged");
});

test("Application: sap.ui5/models: " +
	"Do not replace supportedLocales when supportedLocales are set to array with empty string",
async (t) => {
	const {manifestEnricher, fs} = t.context;
	const input = JSON.stringify({
		"_version": "1.58.0",
		"sap.app": {
			"id": "sap.ui.demo.app",
			"type": "application"
		},
		"sap.ui5": {
			"models": {
				"i18n": {
					"type": "sap.ui.model.resource.ResourceModel",
					"settings": {
						"bundleName": "sap.ui.demo.app.i18nModel.i18n",
						"supportedLocales": [""],
						"fallbackLocale": ""
					}
				}
			}
		}
	}, null, 2);

	const resource = createResource("/resources/sap/ui/demo/app/manifest.json", true, input,
		(actual) => t.fail("setString should never be called because resource should not be changed"));

	fs.readdir.withArgs("/resources/sap/ui/demo/app/i18nModel")
		.callsArgWith(1, null, ["i18n_de.properties", "i18n_en.properties"]);

	const processedResources = await manifestEnricher({
		resources: [resource],
		fs
	});

	t.deepEqual(processedResources, [undefined], "No resource is returned, because it is not changed");
	t.true(t.context.logWarnSpy.notCalled, "No warnings should be logged");
	t.true(t.context.logErrorSpy.notCalled, "No errors should be logged");
});

test("Application: sap.ui5/models: " +
	"Log error, no supportedLocales generation if fallbackLocale is not part of generation",
async (t) => {
	const {manifestEnricher, fs} = t.context;
	const input = JSON.stringify({
		"_version": "1.58.0",
		"sap.app": {
			"id": "sap.ui.demo.app",
			"type": "application"
		},
		"sap.ui5": {
			"models": {
				"i18n": {
					"type": "sap.ui.model.resource.ResourceModel",
					"settings": {
						"bundleName": "sap.ui.demo.app.i18nModel.i18n",
						"fallbackLocale": "fr"
					}
				}
			}
		}
	}, null, 2);

	const expected = JSON.stringify({
		"_version": "1.58.0",
		"sap.app": {
			"id": "sap.ui.demo.app",
			"type": "application"
		},
		"sap.ui5": {
			"models": {
				"i18n": {
					"type": "sap.ui.model.resource.ResourceModel",
					"settings": {
						"bundleName": "sap.ui.demo.app.i18nModel.i18n",
						"fallbackLocale": "fr"
					}
				}
			}
		}
	}, null, 2);

	const resource = createResource("/resources/sap/ui/demo/app/manifest.json", true, input,
		(actual) => t.deepEqual(actual, expected, "Correct file content should be set"));
		// TODO: add sinon stub for setString

	fs.readdir.withArgs("/resources/sap/ui/demo/app/i18nModel")
		.callsArgWith(1, null, ["i18n_de.properties", "i18n_en.properties"]);

	const processedResources = await manifestEnricher({
		resources: [resource],
		fs
	});

	t.deepEqual(processedResources, [undefined], "Input resource is returned");
	t.true(t.context.logWarnSpy.notCalled, "No warnings should be logged");
	t.is(t.context.logErrorSpy.callCount, 1, "1 error should be logged");
	t.is(t.context.logErrorSpy.getCall(0).args[0],
		"manifest.json: Generated supported locales ('de', 'en') not containing the defined fallback locale 'fr'. "+
		"Either provide a properties file for defined fallbackLocale or configure another available fallbackLocale",
		"Error message should be correct");
});

test("Application: sap.ui5/models: " +
	"Log warning, but generate locales if default fallbackLocale is not part of generation",
async (t) => {
	const {manifestEnricher, fs} = t.context;
	const input = JSON.stringify({
		"_version": "1.58.0",
		"sap.app": {
			"id": "sap.ui.demo.app",
			"type": "application"
		},
		"sap.ui5": {
			"models": {
				"i18n": {
					"type": "sap.ui.model.resource.ResourceModel",
					"settings": {
						"bundleName": "sap.ui.demo.app.i18nModel.i18n"
					}
				}
			}
		}
	}, null, 2);

	const expected = JSON.stringify({
		"_version": "1.58.0",
		"sap.app": {
			"id": "sap.ui.demo.app",
			"type": "application"
		},
		"sap.ui5": {
			"models": {
				"i18n": {
					"type": "sap.ui.model.resource.ResourceModel",
					"settings": {
						"bundleName": "sap.ui.demo.app.i18nModel.i18n",
						"supportedLocales": ["de", "fr"]
					}
				}
			}
		}
	}, null, 2);

	const resource = createResource("/resources/sap/ui/demo/app/manifest.json", true, input,
		(actual) => t.deepEqual(actual, expected, "Correct file content should be set"));

	fs.readdir.withArgs("/resources/sap/ui/demo/app/i18nModel")
		.callsArgWith(1, null, ["i18n_de.properties", "i18n_fr.properties"]);

	const processedResources = await manifestEnricher({
		resources: [resource],
		fs
	});

	t.deepEqual(processedResources, [resource], "Input resource is returned");
	t.is(t.context.logWarnSpy.callCount, 1, "1 warning should be logged");
	t.is(t.context.logWarnSpy.getCall(0).args[0],
		"manifest.json: Generated supported locales ('de', 'fr') " +
		"do not contain default fallback locale 'en'. " +
		"Either provide a properties file for 'en' or configure another available fallbackLocale",
		"1 warning should be logged");
	t.true(t.context.logErrorSpy.notCalled, "No errors should be logged");
});

test("Application: sap.ui5/models: Log verbose if manifest version is not defined at all", async (t) => {
	const {manifestEnricher, fs} = t.context;
	const input = JSON.stringify({
		"sap.app": {
			"id": "sap.ui.demo.app",
			"type": "application"
		},
		"sap.ui5": {
			"models": {
				"i18n": {
					"type": "sap.ui.model.resource.ResourceModel",
					"settings": {
						"bundleName": "sap.ui.demo.app.i18n.i18n"
					}
				}
			}
		}
	}, null, 2);

	const resource = createResource("/resources/sap/ui/demo/app/manifest.json", true, input,
		(actual) => t.fail("setString should never be called because resource should not be changed"));

	const processedResources = await manifestEnricher({
		resources: [resource],
		fs
	});

	t.deepEqual(processedResources, [undefined], "No resource is returned, because it is not changed");
	t.is(t.context.logVerboseSpy.callCount, 1, "1 verbose should be logged");
	t.is(t.context.logVerboseSpy.getCall(0).args[0],
		"manifest.json: _version is not defined. No supportedLocales are generated");
	t.true(t.context.logWarnSpy.notCalled, "No warning should be logged");
	t.true(t.context.logErrorSpy.notCalled, "No errors should be logged");
	t.is(fs.readdir.callCount, 0, "readdir should not be called because _version is not defined");
});

test("Application: sap.ui5/models: Log verbose if manifest version is below 1.21.0", async (t) => {
	const {manifestEnricher, fs} = t.context;
	const input = JSON.stringify({
		"_version": "1.20.0",
		"sap.app": {
			"id": "sap.ui.demo.app",
			"type": "application"
		},
		"sap.ui5": {
			"models": {
				"i18n": {
					"type": "sap.ui.model.resource.ResourceModel",
					"settings": {
						"bundleName": "sap.ui.demo.app.i18n.i18n"
					}
				}
			}
		}
	}, null, 2);

	const resource = createResource("/resources/sap/ui/demo/app/manifest.json", true, input,
		(actual) => t.fail("setString should never be called because resource should not be changed"));

	fs.readdir.withArgs("/resources/sap/ui/demo/app/i18n")
		.callsArgWith(1, null, ["i18n_de.properties", "i18n_en.properties"]);

	const processedResources = await manifestEnricher({
		resources: [resource],
		fs
	});

	t.deepEqual(processedResources, [undefined], "No resource is returned, because it is not changed");
	t.is(t.context.logVerboseSpy.callCount, 1, "1 verbose should be logged");
	t.is(t.context.logVerboseSpy.getCall(0).args[0],
		"manifest.json: _version is lower than 1.21.0 so no supportedLocales can be generated");
	t.true(t.context.logWarnSpy.notCalled, "No warning should be logged");
	t.true(t.context.logErrorSpy.notCalled, "No errors should be logged");
	t.is(fs.readdir.callCount, 0, "readdir should not be called because _version is lower than 1.21.0");
});

test("Application: sap.ui5/models: " +
	"Do not generate supportedLocales when bundleUrl pointing to a location outside the current project",
async (t) => {
	const {manifestEnricher, fs} = t.context;
	const input = JSON.stringify({
		"_version": "1.58.0",
		"sap.app": {
			"id": "sap.ui.demo.app",
			"type": "application"
		},
		"sap.ui5": {
			"models": {
				"i18n": {
					"type": "sap.ui.model.resource.ResourceModel",
					"settings": {
						"bundleUrl": "../../myapp2/i18n/i18n.properties"
					}
				}
			}
		}
	}, null, 2);

	const resource = createResource("/resources/sap/ui/demo/app/manifest.json", true, input,
		(actual) => t.fail("setString should never be called because resource should not be changed"));

	const processedResources = await manifestEnricher({
		resources: [resource],
		fs
	});

	t.deepEqual(processedResources, [undefined], "No resource is returned, because it is not changed");
	t.is(t.context.logVerboseSpy.callCount, 1, "1 verbose should be logged");
	t.is(t.context.logVerboseSpy.getCall(0).args[0],
		"manifest.json: bundleUrl '../../myapp2/i18n/i18n.properties' contains a relative path, " +
		"no supportedLocales are generated");
	t.true(t.context.logWarnSpy.notCalled, "No warning should be logged");
	t.true(t.context.logErrorSpy.notCalled, "No errors should be logged");
	t.is(fs.readdir.callCount, 0, "readdir should not be called");
});

test("Application: sap.ui5/models: " +
	"Do not generate supportedLocales when bundleUrl pointing to a location inside the current project",
async (t) => {
	const {manifestEnricher, fs} = t.context;
	const input = JSON.stringify({
		"_version": "1.58.0",
		"sap.app": {
			"id": "sap.ui.demo.app",
			"type": "application"
		},
		"sap.ui5": {
			"models": {
				"i18n": {
					"type": "sap.ui.model.resource.ResourceModel",
					"settings": {
						"bundleUrl": "../i18n/i18n.properties",
						"fallbackLocale": "de"
					}
				}
			}
		}
	}, null, 2);

	const expected = JSON.stringify({
		"_version": "1.58.0",
		"sap.app": {
			"id": "sap.ui.demo.app",
			"type": "application"
		},
		"sap.ui5": {
			"models": {
				"i18n": {
					"type": "sap.ui.model.resource.ResourceModel",
					"settings": {
						"bundleUrl": "../i18n/i18n.properties",
						"fallbackLocale": "de",
						"supportedLocales": ["de", "en"]
					}
				}
			}
		}
	}, null, 2);

	const resource = createResource("/resources/sap/ui/demo/app/manifest.json", true, input,
		(actual) => t.deepEqual(actual, expected, "Correct file content should be set"));

	const processedResources = await manifestEnricher({
		resources: [resource],
		fs
	});

	t.deepEqual(processedResources, [undefined], "No resource is returned, because it is not changed");
	t.is(t.context.logVerboseSpy.callCount, 1, "1 verbose should be logged");
	t.is(t.context.logVerboseSpy.getCall(0).args[0],
		"manifest.json: bundleUrl '../i18n/i18n.properties' contains a relative path, " +
		"no supportedLocales are generated");
	t.true(t.context.logWarnSpy.notCalled, "No warning should be logged");
	t.true(t.context.logErrorSpy.notCalled, "No errors should be logged");
	t.is(fs.readdir.callCount, 0, "readdir should not be called");
});

test("Application: sap.ui5/models: " +
	"Do not replace supportedLocales when bundle is not part of the namespace",
async (t) => {
	const {manifestEnricher, fs} = t.context;
	const input = JSON.stringify({
		"_version": "1.58.0",
		"sap.app": {
			"id": "sap.ui.demo.app",
			"type": "application"
		},
		"sap.ui5": {
			"models": {
				"i18n": {
					"type": "sap.ui.model.resource.ResourceModel",
					"settings": {
						"bundleName": "sap.ui.demo.app.i18nModel.i18n",
						"fallbackLocale": "de"
					}
				},
				"i18n_reuse_lib": {
					"type": "sap.ui.model.resource.ResourceModel",
					"settings": {
						"bundleName": "sap.ui.demo.lib.i18n.i18n",
						"async": true
					}
				}
			}
		}
	}, null, 2);

	const expected = JSON.stringify({
		"_version": "1.58.0",
		"sap.app": {
			"id": "sap.ui.demo.app",
			"type": "application"
		},
		"sap.ui5": {
			"models": {
				"i18n": {
					"type": "sap.ui.model.resource.ResourceModel",
					"settings": {
						"bundleName": "sap.ui.demo.app.i18nModel.i18n",
						"fallbackLocale": "de",
						"supportedLocales": ["de", "en"]
					}
				},
				"i18n_reuse_lib": {
					"type": "sap.ui.model.resource.ResourceModel",
					"settings": {
						"bundleName": "sap.ui.demo.lib.i18n.i18n",
						"async": true
					}
				}
			}
		}
	}, null, 2);

	const resource = createResource("/resources/sap/ui/demo/app/manifest.json", true, input,
		(actual) => t.deepEqual(actual, expected, "Correct file content should be set"));

	fs.readdir.withArgs("/resources/sap/ui/demo/app/i18nModel")
		.callsArgWith(1, null, ["i18n_de.properties", "i18n_en.properties"]);

	const processedResources = await manifestEnricher({
		resources: [resource],
		fs
	});

	t.deepEqual(processedResources, [resource], "Input resource is returned");

	t.is(t.context.logVerboseSpy.callCount, 1);
	t.is(t.context.logVerboseSpy.getCall(0).args[0],
		"manifest.json: bundleName 'sap.ui.demo.lib.i18n.i18n' contains a path which is not part of the project, " +
		"no supportedLocales are generated");
	t.true(t.context.logWarnSpy.notCalled, "No warnings should be logged");
	t.true(t.context.logErrorSpy.notCalled, "No errors should be logged");
	t.is(fs.readdir.callCount, 0, "readdir should not be called");
});

test("Application: sap.ui5/models: " +
	"Do not generate supportedLocales when bundle is not part of the namespace (bundleUrl with ui5 protocol)",
async (t) => {
	const {manifestEnricher, fs} = t.context;
	const input = JSON.stringify({
		"_version": "1.58.0",
		"sap.app": {
			"id": "sap.ui.demo.app",
			"type": "application"
		},
		"sap.ui5": {
			"models": {
				"i18n": {
					"type": "sap.ui.model.resource.ResourceModel",
					"settings": {
						"bundleName": "sap.ui.demo.app.i18nModel.i18n",
						"fallbackLocale": "de"
					}
				},
				"i18n_reuse_lib": {
					"type": "sap.ui.model.resource.ResourceModel",
					"settings": {
						"bundleUrl": "ui5://sap/ui/demo/lib/i18n/i18n.properties",
						"async": true
					}
				}
			}
		}
	}, null, 2);

	const expected = JSON.stringify({
		"_version": "1.58.0",
		"sap.app": {
			"id": "sap.ui.demo.app",
			"type": "application"
		},
		"sap.ui5": {
			"models": {
				"i18n": {
					"type": "sap.ui.model.resource.ResourceModel",
					"settings": {
						"bundleName": "sap.ui.demo.app.i18nModel.i18n",
						"fallbackLocale": "de",
						"supportedLocales": ["de", "en"]
					}
				},
				"i18n_reuse_lib": {
					"type": "sap.ui.model.resource.ResourceModel",
					"settings": {
						"bundleUrl": "ui5://sap/ui/demo/lib/i18n/i18n.properties",
						"async": true
					}
				}
			}
		}
	}, null, 2);

	const resource = createResource("/resources/sap/ui/demo/app/manifest.json", true, input,
		(actual) => t.deepEqual(actual, expected, "Correct file content should be set"));

	fs.readdir.withArgs("/resources/sap/ui/demo/app/i18nModel")
		.callsArgWith(1, null, ["i18n_de.properties", "i18n_en.properties"]);

	const processedResources = await manifestEnricher({
		resources: [resource],
		fs
	});

	t.deepEqual(processedResources, [resource], "Input resource is returned");

	t.is(t.context.logVerboseSpy.callCount, 1);
	t.is(t.context.logVerboseSpy.getCall(0).args[0],
		"manifest.json: bundleUrl 'ui5://sap/ui/demo/lib/i18n/i18n.properties' contains a path which is not part of the project, " +
		"no supportedLocales are generated");
	t.true(t.context.logWarnSpy.notCalled, "No warnings should be logged");
	t.true(t.context.logErrorSpy.notCalled, "No errors should be logged");
});


// #######################################################
// Type: Component
// #######################################################

// Currently we have no specific coding for components, should be treated the same way as type application

// #######################################################
// Type: Card
// #######################################################

// Currently we have no specific coding for cards, should be treated the same way as type application

// #######################################################
// Type: Library
// #######################################################

test("Library: No replacement at all", async (t) => {
	const {manifestEnricher, fs} = t.context;
	const input = JSON.stringify({
		"_version": "1.58.0",
		"sap.app": {
			"id": "sap.ui.demo.lib",
			"type": "library"
		}
	}, null, 2);

	const resource = createResource("/resources/sap/ui/demo/lib/manifest.json", true, input,
		(actual) => t.fail("setString should never be called because resource should not be changed"));

	fs.readdir.withArgs("/resources/sap/ui/demo/app/i18n")
		.callsArgWith(1, null, ["i18n_de.properties", "i18n_en.properties"]);

	const processedResources = await manifestEnricher({
		resources: [resource],
		fs
	});

	t.deepEqual(processedResources, [undefined], "No resource is returned, because it is not changed");

	t.true(t.context.logWarnSpy.notCalled, "No warnings should be logged");
	t.true(t.context.logErrorSpy.notCalled, "No errors should be logged");
});

test("Library: sap.app/i18n (with templates, no bundle defined): " +
	"Does not add supportedLocales, as sap.app/i18n is not valid for libraries",
async (t) => {
	const {manifestEnricher, fs} = t.context;
	const input = JSON.stringify({
		"_version": "1.58.0",
		"sap.app": {
			"id": "sap.ui.demo.lib",
			"type": "library",
			"title": "{{title}}"
		}
	}, null, 2);

	const resource = createResource("/resources/sap/ui/demo/lib/manifest.json", true, input,
		(actual) => t.fail("setString should never be called because resource should not be changed"));

	fs.readdir.withArgs("/resources/sap/ui/demo/app/i18n")
		.callsArgWith(1, null, ["i18n_de.properties", "i18n_en.properties"]);

	const processedResources = await manifestEnricher({
		resources: [resource],
		fs
	});

	t.deepEqual(processedResources, [undefined], "No resource is returned, because it is not changed");

	t.true(t.context.logWarnSpy.notCalled, "No warnings should be logged");
	t.true(t.context.logErrorSpy.notCalled, "No errors should be logged");
});

test("Library: sap.app/i18n (with custom bundle): " +
	"Does not add supportedLocales, as sap.app/i18n is not valid for libraries",
async (t) => {
	const {manifestEnricher, fs} = t.context;
	const input = JSON.stringify({
		"_version": "1.58.0",
		"sap.app": {
			"id": "sap.ui.demo.lib",
			"type": "library",
			"i18n": "mybundle.properties"
		}
	}, null, 2);

	const resource = createResource("/resources/sap/ui/demo/lib/manifest.json", true, input,
		(actual) => t.is(actual, "", "Correct file content should be set"));

	fs.readdir.withArgs("/resources/sap/ui/demo/app/i18n")
		.callsArgWith(1, null, ["mybundle_de.properties", "mybundle_en.properties"]);

	const processedResources = await manifestEnricher({
		resources: [resource],
		fs
	});

	t.deepEqual(processedResources, [undefined], "Input resource is returned");

	t.true(t.context.logWarnSpy.notCalled, "No warnings should be logged");
	t.true(t.context.logErrorSpy.notCalled, "No errors should be logged");
});

test("Library: sap.ui5/library: Replaces supportedLocales with available properties files", async (t) => {
	const {manifestEnricher, fs} = t.context;
	const input = JSON.stringify({
		"_version": "1.58.0",
		"sap.app": {
			"id": "sap.ui.demo.lib",
			"type": "library"
		},
		"sap.ui5": {
			"library": {
				"i18n": {
					"bundleUrl": "i18nc/messagebundlec.properties",
					"fallbackLocale": "de"
				}
			}
		}
	}, null, 2);

	const expected = JSON.stringify({
		"_version": "1.58.0",
		"sap.app": {
			"id": "sap.ui.demo.lib",
			"type": "library"
		},
		"sap.ui5": {
			"library": {
				"i18n": {
					"bundleUrl": "i18nc/messagebundlec.properties",
					"fallbackLocale": "de",
					"supportedLocales": ["de", "en"]
				}
			}
		}
	}, null, 2);

	const resource = createResource("/resources/sap/ui/demo/lib/manifest.json", true, input,
		(actual) => t.deepEqual(actual, expected, "Correct file content should be set"));

	fs.readdir.withArgs("/resources/sap/ui/demo/lib/i18nc")
		.callsArgWith(1, null, ["messagebundlec_de.properties", "messagebundlec_en.properties"]);

	const processedResources = await manifestEnricher({
		resources: [resource],
		fs
	});

	t.deepEqual(processedResources, [resource], "Input resource is returned");

	t.true(t.context.logWarnSpy.notCalled, "No warnings should be logged");
	t.true(t.context.logErrorSpy.notCalled, "No errors should be logged");
});

test("Library: sap.ui5/library: " +
	"Replaces supportedLocales with available properties files (i18n=true)",
async (t) => {
	const {manifestEnricher, fs} = t.context;
	const input = JSON.stringify({
		"_version": "1.58.0",
		"sap.app": {
			"id": "sap.ui.demo.lib",
			"type": "library"
		},
		"sap.ui5": {
			"library": {
				"i18n": true
			}
		}
	}, null, 2);

	const expected = JSON.stringify({
		"_version": "1.58.0",
		"sap.app": {
			"id": "sap.ui.demo.lib",
			"type": "library"
		},
		"sap.ui5": {
			"library": {
				"i18n": {
					"bundleUrl": "messagebundle.properties",
					"supportedLocales": ["de", "en"]
				}
			}
		}
	}, null, 2);

	const resource = createResource("/resources/sap/ui/demo/lib/manifest.json", true, input,
		(actual) => t.deepEqual(actual, expected, "Correct file content should be set"));

	fs.readdir.withArgs("/resources/sap/ui/demo/lib")
		.callsArgWith(1, null, ["messagebundle_de.properties", "messagebundle_en.properties"]);

	const processedResources = await manifestEnricher({
		resources: [resource],
		fs
	});

	t.deepEqual(processedResources, [resource], "Input resource is returned");

	t.true(t.context.logWarnSpy.notCalled, "No warnings should be logged");
	t.true(t.context.logErrorSpy.notCalled, "No errors should be logged");
});

test("Library: sap.ui5/library: Do not generate supportedLocales with disabled i18n feature", async (t) => {
	const {manifestEnricher, fs} = t.context;
	const input = JSON.stringify({
		"_version": "1.58.0",
		"sap.app": {
			"id": "sap.ui.demo.lib",
			"type": "library"
		},
		"sap.ui5": {
			"library": {
				"i18n": false
			}
		}
	}, null, 2);

	const resource = createResource("/resources/sap/ui/demo/lib/manifest.json", true, input,
		(actual) => t.fail("setString should never be called because resource should not be changed"));

	fs.readdir.withArgs("/resources/sap/ui/demo/lib")
		.callsArgWith(1, null, ["messagebundle_de.properties", "messagebundle_en.properties"]);

	const processedResources = await manifestEnricher({
		resources: [resource],
		fs
	});

	t.deepEqual(processedResources, [undefined], "No resource is returned, because it is not changed");

	t.true(t.context.logWarnSpy.notCalled, "No warnings should be logged");
	t.true(t.context.logErrorSpy.notCalled, "No errors should be logged");
});

test("Library: sap.ui5/library: Replaces supportedLocales with terminologies", async (t) => {
	const {manifestEnricher, fs} = t.context;
	const input = JSON.stringify({
		"_version": "1.58.0",
		"sap.app": {
			"id": "sap.ui.demo.lib",
			"type": "library"
		},
		"sap.ui5": {
			"library": {
				"i18n": {
					"bundleUrl": "i18nc/messagebundlec.properties",
					"terminologies": {
						"sports": {
							"bundleUrl": "i18nc_sports/messagebundle.sports.properties"
						}
					}
				}
			}
		}
	}, null, 2);

	const expected = JSON.stringify({
		"_version": "1.58.0",
		"sap.app": {
			"id": "sap.ui.demo.lib",
			"type": "library"
		},
		"sap.ui5": {
			"library": {
				"i18n": {
					"bundleUrl": "i18nc/messagebundlec.properties",
					"terminologies": {
						"sports": {
							"bundleUrl": "i18nc_sports/messagebundle.sports.properties",
							"supportedLocales": ["", "de", "en"]
						}
					},
					"supportedLocales": ["", "de", "en"],
				}
			}
		}
	}, null, 2);

	const resource = createResource("/resources/sap/ui/demo/lib/manifest.json", true, input,
		(actual) => t.deepEqual(actual, expected, "Correct file content should be set"));

	fs.readdir.withArgs("/resources/sap/ui/demo/lib/i18nc")
		.callsArgWith(1, null, [
			"messagebundlec_de.properties",
			"messagebundlec_en.properties",
			"messagebundlec.properties"
		]);

	fs.readdir.withArgs("/resources/sap/ui/demo/lib/i18nc_sports")
		.callsArgWith(1, null, [
			"messagebundle.sports_de.properties",
			"messagebundle.sports_en.properties",
			"messagebundle.sports.properties"
		]);

	const processedResources = await manifestEnricher({
		resources: [resource],
		fs
	});

	t.deepEqual(processedResources, [resource], "Input resource is returned");

	t.true(t.context.logWarnSpy.notCalled, "No warnings should be logged");
	t.true(t.context.logErrorSpy.notCalled, "No errors should be logged");
});

test("Library: sap.ui5/library: Replaces supportedLocales with terminologies not bundle level", async (t) => {
	const {manifestEnricher, fs} = t.context;
	const input = JSON.stringify({
		"_version": "1.58.0",
		"sap.app": {
			"id": "sap.ui.demo.lib",
			"type": "library"
		},
		"sap.ui5": {
			"library": {
				"i18n": {
					"bundleUrl": "i18nc/messagebundlec.properties",
					"supportedLocales": ["pt"],
					"terminologies": {
						"sports": {
							"bundleUrl": "i18nc_sports/messagebundle.sports.properties"
						}
					}
				}
			}
		}
	}, null, 2);

	const expected = JSON.stringify({
		"_version": "1.58.0",
		"sap.app": {
			"id": "sap.ui.demo.lib",
			"type": "library"
		},
		"sap.ui5": {
			"library": {
				"i18n": {
					"bundleUrl": "i18nc/messagebundlec.properties",
					"supportedLocales": ["pt"],
					"terminologies": {
						"sports": {
							"bundleUrl": "i18nc_sports/messagebundle.sports.properties",
							"supportedLocales": ["", "de", "en"]
						}
					}
				}
			}
		}
	}, null, 2);

	const resource = createResource("/resources/sap/ui/demo/lib/manifest.json", true, input,
		(actual) => t.deepEqual(actual, expected, "Correct file content should be set"));

	fs.readdir.withArgs("/resources/sap/ui/demo/lib/i18nc")
		.callsArgWith(1, null, [
			"messagebundlec_de.properties",
			"messagebundlec_en.properties",
			"messagebundlec.properties"
		]);

	fs.readdir.withArgs("/resources/sap/ui/demo/lib/i18nc_sports")
		.callsArgWith(1, null, [
			"messagebundle.sports_de.properties",
			"messagebundle.sports_en.properties",
			"messagebundle.sports.properties"
		]);

	const processedResources = await manifestEnricher({
		resources: [resource],
		fs
	});

	t.deepEqual(processedResources, [resource], "Input resource is returned");

	t.true(t.context.logWarnSpy.notCalled, "No warnings should be logged");
	t.true(t.context.logErrorSpy.notCalled, "No errors should be logged");
});

test("Library: sap.ui5/library: Replaces supportedLocales with deactivated terminologies", async (t) => {
	const {manifestEnricher, fs} = t.context;
	const input = JSON.stringify({
		"_version": "1.58.0",
		"sap.app": {
			"id": "sap.ui.demo.lib",
			"type": "library"
		},
		"sap.ui5": {
			"library": {
				"i18n": {
					"bundleUrl": "i18nc/messagebundlec.properties",
					"terminologies": {
						"sports": {
							"bundleUrl": "i18nc_sports/messagebundle.sports.properties",
							"supportedLocales": ["pt"]
						}
					}
				}
			}
		}
	}, null, 2);

	const expected = JSON.stringify({
		"_version": "1.58.0",
		"sap.app": {
			"id": "sap.ui.demo.lib",
			"type": "library"
		},
		"sap.ui5": {
			"library": {
				"i18n": {
					"bundleUrl": "i18nc/messagebundlec.properties",
					"terminologies": {
						"sports": {
							"bundleUrl": "i18nc_sports/messagebundle.sports.properties",
							"supportedLocales": ["pt"]
						}
					},
					"supportedLocales": ["", "de", "en"],
				}
			}
		}
	}, null, 2);

	const resource = createResource("/resources/sap/ui/demo/lib/manifest.json", true, input,
		(actual) => t.deepEqual(actual, expected, "Correct file content should be set"));

	fs.readdir.withArgs("/resources/sap/ui/demo/lib/i18nc")
		.callsArgWith(1, null, [
			"messagebundlec_de.properties",
			"messagebundlec_en.properties",
			"messagebundlec.properties"
		]);

	fs.readdir.withArgs("/resources/sap/ui/demo/lib/i18nc_sports")
		.callsArgWith(1, null, [
			"messagebundle.sports_de.properties",
			"messagebundle.sports_en.properties",
			"messagebundle.sports.properties"
		]);

	const processedResources = await manifestEnricher({
		resources: [resource],
		fs
	});

	t.deepEqual(processedResources, [resource], "Input resource is returned");

	t.true(t.context.logWarnSpy.notCalled, "No warnings should be logged");
	t.true(t.context.logErrorSpy.notCalled, "No errors should be logged");
});

test("Library: sap.ui5/library: Replaces supportedLocales with enhanceWith", async (t) => {
	const {manifestEnricher, fs} = t.context;
	const input = JSON.stringify({
		"_version": "1.58.0",
		"sap.app": {
			"id": "sap.ui.demo.lib",
			"type": "library"
		},
		"sap.ui5": {
			"library": {
				"i18n": {
					"bundleUrl": "i18nc/messagebundlec.properties",
					"enhanceWith": [
						{
							"bundleUrl": "myfolder1/messagebundlenc1.properties"
						},
						{
							"bundleUrl": "myfolder2/messagebundlenc2.properties"
						}
					]
				}
			}
		}
	}, null, 2);

	const expected = JSON.stringify({
		"_version": "1.58.0",
		"sap.app": {
			"id": "sap.ui.demo.lib",
			"type": "library"
		},
		"sap.ui5": {
			"library": {
				"i18n": {
					"bundleUrl": "i18nc/messagebundlec.properties",
					"enhanceWith": [
						{
							"bundleUrl": "myfolder1/messagebundlenc1.properties",
							"supportedLocales": ["", "de", "en"]
						},
						{
							"bundleUrl": "myfolder2/messagebundlenc2.properties",
							"supportedLocales": ["", "de", "en"]
						}
					],
					"supportedLocales": ["", "de", "en"],
				}
			}
		}
	}, null, 2);

	const resource = createResource("/resources/sap/ui/demo/lib/manifest.json", true, input,
		(actual) => t.deepEqual(actual, expected, "Correct file content should be set"));

	fs.readdir.withArgs("/resources/sap/ui/demo/lib/i18nc")
		.callsArgWith(1, null, [
			"messagebundlec_de.properties",
			"messagebundlec_en.properties",
			"messagebundlec.properties"
		]);

	fs.readdir.withArgs("/resources/sap/ui/demo/lib/myfolder1")
		.callsArgWith(1, null, [
			"messagebundlenc1_de.properties",
			"messagebundlenc1_en.properties",
			"messagebundlenc1.properties"
		]);

	fs.readdir.withArgs("/resources/sap/ui/demo/lib/myfolder1")
		.callsArgWith(1, null, [
			"messagebundlenc2_de.properties",
			"messagebundlenc2_en.properties",
			"messagebundlenc2.properties"
		]);

	const processedResources = await manifestEnricher({
		resources: [resource],
		fs
	});

	t.deepEqual(processedResources, [resource], "Input resource is returned");

	t.true(t.context.logWarnSpy.notCalled, "No warnings should be logged");
	t.true(t.context.logErrorSpy.notCalled, "No errors should be logged");
});

test("Library: sap.ui5/library: Replaces supportedLocales with enhanceWith and terminologies", async (t) => {
	const {manifestEnricher, fs} = t.context;
	const input = JSON.stringify({
		"_version": "1.58.0",
		"sap.app": {
			"id": "sap.ui.demo.lib",
			"type": "library"
		},
		"sap.ui5": {
			"library": {
				"i18n": {
					"bundleUrl": "i18nc/messagebundlec.properties",
					"terminologies": {
						"sports": {
							"bundleUrl": "i18nc_sports/messagebundle.sports.properties"
						}
					},
					"enhanceWith": [
						{
							"bundleUrl": "myfolder1/messagebundlenc1.properties",
							"terminologies": {
								"sports": {
									"bundleUrl": "i18nc_sports_soccer/messagebundle.soccer.properties"
								}
							}
						},
						{
							"bundleUrl": "myfolder2/messagebundlenc2.properties",
							"terminologies": {
								"sports": {
									"bundleUrl": "i18nc_sports_soccer_el/messagebundle.elsoccer.properties"
								}
							}
						}
					]
				}
			}
		}
	}, null, 2);

	const expected = JSON.stringify({
		"_version": "1.58.0",
		"sap.app": {
			"id": "sap.ui.demo.lib",
			"type": "library"
		},
		"sap.ui5": {
			"library": {
				"i18n": {
					"bundleUrl": "i18nc/messagebundlec.properties",
					"terminologies": {
						"sports": {
							"bundleUrl": "i18nc_sports/messagebundle.sports.properties",
							"supportedLocales": ["", "de", "en"]
						}
					},
					"enhanceWith": [
						{
							"bundleUrl": "myfolder1/messagebundlenc1.properties",
							"terminologies": {
								"sports": {
									"bundleUrl": "i18nc_sports_soccer/messagebundle.soccer.properties",
									"supportedLocales": ["", "de", "en"]
								}
							},
							"supportedLocales": ["", "de", "en"]
						},
						{
							"bundleUrl": "myfolder2/messagebundlenc2.properties",
							"terminologies": {
								"sports": {
									"bundleUrl": "i18nc_sports_soccer_el/messagebundle.elsoccer.properties",
									"supportedLocales": ["", "de", "en"]
								}
							},
							"supportedLocales": ["", "de", "en"]
						}
					],
					"supportedLocales": ["", "de", "en"],
				}
			}
		}
	}, null, 2);

	const resource = createResource("/resources/sap/ui/demo/lib/manifest.json", true, input,
		(actual) => t.deepEqual(actual, expected, "Correct file content should be set"));

	fs.readdir.withArgs("/resources/sap/ui/demo/lib/myfolder1")
		.callsArgWith(1, null, [
			"messagebundlenc1_de.properties",
			"messagebundlenc1_en.properties",
			"messagebundlenc1.properties"
		]);

	fs.readdir.withArgs("/resources/sap/ui/demo/lib/myfolder2")
		.callsArgWith(1, null, [
			"messagebundlenc2_de.properties",
			"messagebundlenc2_en.properties",
			"messagebundlenc2.properties"
		]);

	fs.readdir.withArgs("/resources/sap/ui/demo/lib/i18nc_sports")
		.callsArgWith(1, null, [
			"messagebundle.sports_de.properties",
			"messagebundle.sports_en.properties",
			"messagebundle.sports.properties"
		]);

	fs.readdir.withArgs("/resources/sap/ui/demo/lib/i18nc_sports_soccer")
		.callsArgWith(1, null, [
			"messagebundle.soccer_de.properties",
			"messagebundle.soccer_en.properties",
			"messagebundle.soccer.properties"
		]);

	fs.readdir.withArgs("/resources/sap/ui/demo/lib/i18nc_sports_soccer_el")
		.callsArgWith(1, null, [
			"messagebundle.elsoccer_de.properties",
			"messagebundle.elsoccer_en.properties",
			"messagebundle.elsoccer.properties"
		]);

	fs.readdir.withArgs("/resources/sap/ui/demo/lib/i18nc")
		.callsArgWith(1, null, [
			"messagebundlec_de.properties",
			"messagebundlec_en.properties",
			"messagebundlec.properties"
		]);

	const processedResources = await manifestEnricher({
		resources: [resource],
		fs
	});

	t.deepEqual(processedResources, [resource], "Input resource is returned");

	t.true(t.context.logWarnSpy.notCalled, "No warnings should be logged");
	t.true(t.context.logErrorSpy.notCalled, "No errors should be logged");
});

test("getRelativeBundleUrlFromName", (t) => {
	const {getRelativeBundleUrlFromName} = t.context.__internals__;

	const bundleUrl = getRelativeBundleUrlFromName("sap.ui.demo.app.i18n.i18n", "sap.ui.demo.app");
	t.is(bundleUrl, "i18n/i18n.properties");
});

test("normalizeBundleUrl", (t) => {
	const {normalizeBundleUrl} = t.context.__internals__;

	t.is(
		normalizeBundleUrl("./i18n/i18n.properties", "sap.ui.demo.app"),
		"i18n/i18n.properties"
	);
	t.is(
		normalizeBundleUrl("i18n/i18n.properties", "sap.ui.demo.app"),
		"i18n/i18n.properties"
	);
	t.is(
		normalizeBundleUrl("./i18n/../i18n/i18n.properties", "sap.ui.demo.app"),
		"i18n/i18n.properties"
	);
	t.is(
		normalizeBundleUrl("ui5://sap/ui/demo/app/i18n/i18n.properties", "sap.ui.demo.app"),
		"i18n/i18n.properties"
	);
	t.is(
		normalizeBundleUrl("./i18n/../../other/namespace/i18n.properties", "sap.ui.demo.app"),
		"../other/namespace/i18n.properties"
	);
});

test("ManifestEnricher#processSapAppI18n: No modification (existing supportedLocales)", async (t) => {
	const {ManifestEnricher} = t.context.__internals__;

	const manifest = {
		"_version": "1.58.0",
		"sap.app": {
			"id": "sap.ui.demo.app",
			"type": "application",
			"i18n": {
				"bundleUrl": "i18n/i18n.properties",
				"supportedLocales": ["en", "de"]
			}
		}
	};
	const expectedManifest = JSON.parse(JSON.stringify(manifest));

	const modified = await new ManifestEnricher(t.context.fs, "/manifest.json").processSapAppI18n(manifest);

	t.deepEqual(manifest, expectedManifest, "Manifest object should not be changed");
	t.false(modified, "Manifest should not be modified");
});

test("ManifestEnricher#processSapAppI18n: No properties files, manifest at root-level", async (t) => {
	const {ManifestEnricher} = t.context.__internals__;
	const {fs} = t.context;

	const manifest = {
		"_version": "1.58.0",
		"sap.app": {
			"id": "sap.ui.demo.app",
			"type": "application"
		}
	};
	const expectedManifest = JSON.parse(JSON.stringify(manifest));

	const modified = await new ManifestEnricher(fs, "/manifest.json").processSapAppI18n(manifest);

	t.deepEqual(manifest, expectedManifest, "Manifest object should not be changed");
	t.false(modified, "Manifest should not be modified");

	t.is(fs.readdir.callCount, 1);
	t.is(fs.readdir.getCall(0).args[0], "/i18n");
});

test("ManifestEnricher#processSapAppI18n: No properties files, manifest within namespace", async (t) => {
	const {ManifestEnricher} = t.context.__internals__;
	const {fs} = t.context;

	const manifest = {
		"_version": "1.58.0",
		"sap.app": {
			"id": "sap.ui.demo.app",
			"type": "application"
		}
	};
	const expectedManifest = JSON.parse(JSON.stringify(manifest));

	const modified = await new ManifestEnricher(fs, "/sap/ui/demo/app/manifest.json").processSapAppI18n(manifest);

	t.deepEqual(manifest, expectedManifest, "Manifest object should not be changed");
	t.false(modified, "Manifest should not be modified");

	t.is(fs.readdir.callCount, 1);
	t.is(fs.readdir.getCall(0).args[0], "/sap/ui/demo/app/i18n");
});

// TODO: Missing tests for:
// - sap.app/i18n with terminologies / enhanceWith
