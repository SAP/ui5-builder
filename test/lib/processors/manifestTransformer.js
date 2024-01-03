import test from "ava";
import sinon from "sinon";
import esmock from "esmock";

test.beforeEach(async (t) => {
	t.context.logWarnSpy = sinon.spy();
	t.context.logVerboseSpy = sinon.spy();
	t.context.logErrorSpy = sinon.spy();
	const loggerStub = {
		warn: t.context.logWarnSpy,
		verbose: t.context.logVerboseSpy,
		error: t.context.logErrorSpy
	};
	t.context.manifestTransformer = await esmock("../../../lib/processors/manifestTransformer.js", {
		"@ui5/logger": {
			getLogger: sinon.stub().withArgs("builder:processors:manifestTransformer").returns(loggerStub)
		}
	});
});

test.afterEach.always((t) => {
	sinon.restore();
});


function createResource(path, bNamespaced, input, fnOnSetString) {
	return {
		getString: () => Promise.resolve(input),
		setString: fnOnSetString,
		getProject() {
			return {
				getNamespace() {
					const namespace = path.substring(0, path.lastIndexOf("/") + 1).replace("/resources/", "");
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

test.serial("Application: No replacement at all", async (t) => {
	t.plan(3);
	const {manifestTransformer} = t.context;
	const input = JSON.stringify({
		"_version": "1.58.0",
		"sap.app": {
			"id": "sap.ui.demo.app",
			"type": "application"
		}
	}, null, 2);

	const resource = createResource("/resources/sap/ui/demo/app/manifest.json", true, input,
		(actual) => t.fail("setString should never be called because resource should not be changed"));

	const processedResources = await manifestTransformer({
		resources: [resource],
		fs: {
			readdir(fsPath, callback) {
				return callback(null, ["i18n_de.properties", "i18n_en.properties"]);
			}
		}
	});

	t.deepEqual(processedResources, [undefined], "No resource is returned, because it is not changed");

	t.true(t.context.logWarnSpy.notCalled, "No warnings should be logged");
	t.true(t.context.logErrorSpy.notCalled, "No errors should be logged");
});

test.serial("Application: sap.app/i18n (with templates, default bundle): " +
	"Replaces supportedLocales with available messageproperty files",
async (t) => {
	t.plan(4);
	const {manifestTransformer} = t.context;
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

	const processedResources = await manifestTransformer({
		resources: [resource],
		fs: {
			readdir(fsPath, callback) {
				return callback(null, ["i18n_de.properties", "i18n_en.properties"]);
			}
		}
	});

	t.deepEqual(processedResources, [resource], "Input resource is returned");

	t.true(t.context.logWarnSpy.notCalled, "No warnings should be logged");
	t.true(t.context.logErrorSpy.notCalled, "No errors should be logged");
});

test.serial("Application: sap.app/i18n (with templates, custom bundle): " +
	"Replaces supportedLocales with available messageproperty files",
async (t) => {
	t.plan(4);
	const {manifestTransformer} = t.context;
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

	const processedResources = await manifestTransformer({
		resources: [resource],
		fs: {
			readdir(fsPath, callback) {
				return callback(null, ["mybundle_de.properties", "mybundle_en.properties"]);
			}
		}
	});

	t.deepEqual(processedResources, [resource], "Input resource is returned");

	t.true(t.context.logWarnSpy.notCalled, "No warnings should be logged");
	t.true(t.context.logErrorSpy.notCalled, "No errors should be logged");
});

test.serial("Application: sap.ui5/models: " +
	"Replaces supportedLocales with available messageproperty files",
async (t) => {
	t.plan(4);
	const {manifestTransformer} = t.context;
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
						"bundleName": "sap.ui.demo.app.i18n.i18n",
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
						"bundleName": "sap.ui.demo.app.i18n.i18n",
						"fallbackLocale": "de",
						"supportedLocales": ["de", "en"]
					}
				}
			}
		}
	}, null, 2);

	const resource = createResource("/resources/sap/ui/demo/app/manifest.json", true, input,
		(actual) => t.deepEqual(actual, expected, "Correct file content should be set"));

	const processedResources = await manifestTransformer({
		resources: [resource],
		fs: {
			readdir(fsPath, callback) {
				return callback(null, ["i18n_de.properties", "i18n_en.properties"]);
			}
		}
	});

	t.deepEqual(processedResources, [resource], "Input resource is returned");

	t.true(t.context.logWarnSpy.notCalled, "No warnings should be logged");
	t.true(t.context.logErrorSpy.notCalled, "No errors should be logged");
});

test.serial("Application: sap.ui5/models (bundleUrl): " +
	"Replaces supportedLocales with available messageproperty files",
async (t) => {
	t.plan(4);
	const {manifestTransformer} = t.context;
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
						"bundleUrl": "i18n/i18n.properties",
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
						"bundleUrl": "i18n/i18n.properties",
						"fallbackLocale": "de",
						"supportedLocales": ["de", "en"]
					}
				}
			}
		}
	}, null, 2);

	const resource = createResource("/resources/sap/ui/demo/app/manifest.json", true, input,
		(actual) => t.deepEqual(actual, expected, "Correct file content should be set"));

	const processedResources = await manifestTransformer({
		resources: [resource],
		fs: {
			readdir(fsPath, callback) {
				return callback(null, ["i18n_de.properties", "i18n_en.properties"]);
			}
		}
	});

	t.deepEqual(processedResources, [resource], "Input resource is returned");

	t.true(t.context.logWarnSpy.notCalled, "No warnings should be logged");
	t.true(t.context.logErrorSpy.notCalled, "No errors should be logged");
});

test.serial("Application: sap.ui5/models (bundleUrl with ui5 protocol): " +
	"Replaces supportedLocales with available messageproperty files",
async (t) => {
	t.plan(4);
	const {manifestTransformer} = t.context;
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
						"bundleUrl": "ui5://sap/ui/demo/app/i18n/i18n.properties",
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
						"bundleUrl": "ui5://sap/ui/demo/app/i18n/i18n.properties",
						"fallbackLocale": "de",
						"supportedLocales": ["de", "en"]
					}
				}
			}
		}
	}, null, 2);

	const resource = createResource("/resources/sap/ui/demo/app/manifest.json", true, input,
		(actual) => t.deepEqual(actual, expected, "Correct file content should be set"));

	const processedResources = await manifestTransformer({
		resources: [resource],
		fs: {
			readdir(fsPath, callback) {
				return callback(null, ["i18n_de.properties", "i18n_en.properties"]);
			}
		}
	});

	t.deepEqual(processedResources, [resource], "Input resource is returned");

	t.true(t.context.logWarnSpy.notCalled, "No warnings should be logged");
	t.true(t.context.logErrorSpy.notCalled, "No errors should be logged");
});

test.serial("Application: sap.ui5/models: " +
	"Do not replace supportedLocales when supportedLocales are already defined",
async (t) => {
	t.plan(3);
	const {manifestTransformer} = t.context;
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
						"bundleName": "sap.ui.demo.app.i18n.i18n",
						"supportedLocales": ["en", "fr"],
						"fallbackLocale": "fr"
					}
				}
			}
		}
	}, null, 2);

	const resource = createResource("/resources/sap/ui/demo/app/manifest.json", true, input,
		(actual) => t.fail("setString should never be called because resource should not be changed"));

	const processedResources = await manifestTransformer({
		resources: [resource],
		fs: {
			readdir(fsPath, callback) {
				return callback(null, ["i18n_de.properties", "i18n_en.properties"]);
			}
		}
	});

	t.deepEqual(processedResources, [undefined], "No resource is returned, because it is not changed");
	t.true(t.context.logWarnSpy.notCalled, "No warnings should be logged");
	t.true(t.context.logErrorSpy.notCalled, "No errors should be logged");
});

test.serial("Application: sap.ui5/models: " +
	"Do not replace supportedLocales when supportedLocales are set to array with empty string",
async (t) => {
	t.plan(3);
	const {manifestTransformer} = t.context;
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
						"bundleName": "sap.ui.demo.app.i18n.i18n",
						"supportedLocales": [""],
						"fallbackLocale": ""
					}
				}
			}
		}
	}, null, 2);

	const resource = createResource("/resources/sap/ui/demo/app/manifest.json", true, input,
		(actual) => t.fail("setString should never be called because resource should not be changed"));

	const processedResources = await manifestTransformer({
		resources: [resource],
		fs: {
			readdir(fsPath, callback) {
				return callback(null, ["i18n_de.properties", "i18n_en.properties"]);
			}
		}
	});

	t.deepEqual(processedResources, [undefined], "No resource is returned, because it is not changed");
	t.true(t.context.logWarnSpy.notCalled, "No warnings should be logged");
	t.true(t.context.logErrorSpy.notCalled, "No errors should be logged");
});

test.serial("Application: sap.ui5/models: " +
	"Log error, no supportedLocales generation if fallbackLocale is not part of generation",
async (t) => {
	t.plan(5);
	const {manifestTransformer} = t.context;
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
						"bundleName": "sap.ui.demo.app.i18n.i18n",
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
						"bundleName": "sap.ui.demo.app.i18n.i18n",
						"fallbackLocale": "fr"
					}
				}
			}
		}
	}, null, 2);

	const resource = createResource("/resources/sap/ui/demo/app/manifest.json", true, input,
		(actual) => t.deepEqual(actual, expected, "Correct file content should be set"));

	const processedResources = await manifestTransformer({
		resources: [resource],
		fs: {
			readdir(fsPath, callback) {
				return callback(null, ["i18n_de.properties", "i18n_en.properties"]);
			}
		}
	});

	t.deepEqual(processedResources, [resource], "Input resource is returned");
	t.true(t.context.logWarnSpy.notCalled, "No warnings should be logged");
	t.is(t.context.logErrorSpy.callCount, 1, "1 error should be logged");
	t.is(t.context.logErrorSpy.getCall(0).args[0],
		"manifest.json: Generated supported locales ('de', 'en') not containing the defined fallback locale 'fr'. "+
		"Either provide a properties file for defined fallbackLocale or configure another available fallbackLocale",
		"Error message should be correct");
});

test.serial("Application: sap.ui5/models: " +
	"Log warning, but generate locales if default fallbackLocale is not part of generation",
async (t) => {
	t.plan(5);
	const {manifestTransformer} = t.context;
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
						"bundleName": "sap.ui.demo.app.i18n.i18n"
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
						"bundleName": "sap.ui.demo.app.i18n.i18n",
						"supportedLocales": ["de", "fr"]
					}
				}
			}
		}
	}, null, 2);

	const resource = createResource("/resources/sap/ui/demo/app/manifest.json", true, input,
		(actual) => t.deepEqual(actual, expected, "Correct file content should be set"));

	const processedResources = await manifestTransformer({
		resources: [resource],
		fs: {
			readdir(fsPath, callback) {
				return callback(null, ["i18n_de.properties", "i18n_fr.properties"]);
			}
		}
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

test.serial("Application: sap.ui5/models: Log verbose if manifest version is not defined at all", async (t) => {
	t.plan(5);
	const {manifestTransformer} = t.context;
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

	const processedResources = await manifestTransformer({
		resources: [resource],
		fs: {
			readdir(fsPath, callback) {
				return callback(null, ["i18n_de.properties", "i18n_en.properties"]);
			}
		}
	});

	t.deepEqual(processedResources, [undefined], "No resource is returned, because it is not changed");
	t.is(t.context.logVerboseSpy.callCount, 1, "1 verbose should be logged");
	t.is(t.context.logVerboseSpy.getCall(0).args[0],
		"manifest.json: version is not defined. No supportedLocales are generated");
	t.true(t.context.logWarnSpy.notCalled, "No warning should be logged");
	t.true(t.context.logErrorSpy.notCalled, "No errors should be logged");
});

test.serial("Application: sap.ui5/models: Log verbose if manifest version is below 1.21.0", async (t) => {
	t.plan(5);
	const {manifestTransformer} = t.context;
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

	const processedResources = await manifestTransformer({
		resources: [resource],
		fs: {
			readdir(fsPath, callback) {
				return callback(null, ["i18n_de.properties", "i18n_en.properties"]);
			}
		}
	});

	t.deepEqual(processedResources, [undefined], "Input resource is returned");
	t.is(t.context.logVerboseSpy.callCount, 1, "1 verbose should be logged");
	t.is(t.context.logVerboseSpy.getCall(0).args[0],
		"manifest.json: version is lower than 1.21.0 so no supportedLocales can be generated");
	t.true(t.context.logWarnSpy.notCalled, "No warning should be logged");
	t.true(t.context.logErrorSpy.notCalled, "No errors should be logged");
});

test.serial("Application: sap.ui5/models: " +
	"Do not replace supportedLocales when bundle is not part of the namespace",
async (t) => {
	t.plan(4);
	const {manifestTransformer} = t.context;
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
						"bundleName": "sap.ui.demo.app.i18n.i18n",
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
						"bundleName": "sap.ui.demo.app.i18n.i18n",
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

	const processedResources = await manifestTransformer({
		resources: [resource],
		fs: {
			readdir(fsPath, callback) {
				return callback(null, ["i18n_de.properties", "i18n_en.properties"]);
			}
		}
	});

	t.deepEqual(processedResources, [resource], "Input resource is returned");

	t.true(t.context.logWarnSpy.notCalled, "No warnings should be logged");
	t.true(t.context.logErrorSpy.notCalled, "No errors should be logged");
});

test.serial("Application: sap.ui5/models: " +
	"Do not replace supportedLocales when bundle is not part of the namespace (bundleUrl with ui5 protocol)",
async (t) => {
	t.plan(4);
	const {manifestTransformer} = t.context;
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
						"bundleName": "sap.ui.demo.app.i18n.i18n",
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
						"bundleName": "sap.ui.demo.app.i18n.i18n",
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

	const processedResources = await manifestTransformer({
		resources: [resource],
		fs: {
			readdir(fsPath, callback) {
				return callback(null, ["i18n_de.properties", "i18n_en.properties"]);
			}
		}
	});

	t.deepEqual(processedResources, [resource], "Input resource is returned");

	t.true(t.context.logWarnSpy.notCalled, "No warnings should be logged");
	t.true(t.context.logErrorSpy.notCalled, "No errors should be logged");
});


// #######################################################
// Type: Component
// #######################################################

// Currently we have no specific coding for components, should be threated the same way as type application

// #######################################################
// Type: Card
// #######################################################

// Currently we have no specific coding for cards, should be threated the same way as type application

// #######################################################
// Type: Library
// #######################################################

test.serial("Library: No replacement at all", async (t) => {
	t.plan(3);
	const {manifestTransformer} = t.context;
	const input = JSON.stringify({
		"_version": "1.58.0",
		"sap.app": {
			"id": "sap.ui.demo.lib",
			"type": "library"
		}
	}, null, 2);

	const resource = createResource("/resources/sap/ui/demo/lib/manifest.json", true, input,
		(actual) => t.fail("setString should never be called because resource should not be changed"));

	const processedResources = await manifestTransformer({
		resources: [resource],
		fs: {
			readdir(fsPath, callback) {
				return callback(null, ["i18n_de.properties", "i18n_en.properties"]);
			}
		}
	});

	t.deepEqual(processedResources, [undefined], "No resource is returned, because it is not changed");

	t.true(t.context.logWarnSpy.notCalled, "No warnings should be logged");
	t.true(t.context.logErrorSpy.notCalled, "No errors should be logged");
});

test.serial("Library: sap.app/i18n (with templates, no bundle defined): " +
	"No generation of supportedLocales when no bundleUrl is given",
async (t) => {
	t.plan(3);
	const {manifestTransformer} = t.context;
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

	const processedResources = await manifestTransformer({
		resources: [resource],
		fs: {
			readdir(fsPath, callback) {
				return callback(null, ["i18n_de.properties", "i18n_en.properties"]);
			}
		}
	});

	t.deepEqual(processedResources, [undefined], "Input resource is returned");

	t.true(t.context.logWarnSpy.notCalled, "No warnings should be logged");
	t.true(t.context.logErrorSpy.notCalled, "No errors should be logged");
});

test.serial("Library: sap.app/i18n (with custom bundle): " +
	"Replaces supportedLocales with available messageproperty files",
async (t) => {
	t.plan(4);
	const {manifestTransformer} = t.context;
	const input = JSON.stringify({
		"_version": "1.58.0",
		"sap.app": {
			"id": "sap.ui.demo.lib",
			"type": "library",
			"i18n": "mybundle.properties"
		}
	}, null, 2);

	const expected = JSON.stringify({
		"_version": "1.58.0",
		"sap.app": {
			"id": "sap.ui.demo.lib",
			"type": "library",
			"i18n": {
				"bundleUrl": "mybundle.properties",
				"supportedLocales": ["de", "en"]
			}
		}
	}, null, 2);

	const resource = createResource("/resources/sap/ui/demo/lib/manifest.json", true, input,
		(actual) => t.deepEqual(actual, expected, "Correct file content should be set"));

	const processedResources = await manifestTransformer({
		resources: [resource],
		fs: {
			readdir(fsPath, callback) {
				return callback(null, ["mybundle_de.properties", "mybundle_en.properties"]);
			}
		}
	});

	t.deepEqual(processedResources, [resource], "Input resource is returned");

	t.true(t.context.logWarnSpy.notCalled, "No warnings should be logged");
	t.true(t.context.logErrorSpy.notCalled, "No errors should be logged");
});

test.serial("Library: sap.ui5/library: Replaces supportedLocales with available messageproperty files", async (t) => {
	t.plan(4);
	const {manifestTransformer} = t.context;
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

	const processedResources = await manifestTransformer({
		resources: [resource],
		fs: {
			readdir(fsPath, callback) {
				return callback(null, ["messagebundlec_de.properties", "messagebundlec_en.properties"]);
			}
		}
	});

	t.deepEqual(processedResources, [resource], "Input resource is returned");

	t.true(t.context.logWarnSpy.notCalled, "No warnings should be logged");
	t.true(t.context.logErrorSpy.notCalled, "No errors should be logged");
});

test.serial("Library: sap.ui5/library: " +
	"Replaces supportedLocales with available messageproperty files (i18n=true)",
async (t) => {
	t.plan(4);
	const {manifestTransformer} = t.context;
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

	const processedResources = await manifestTransformer({
		resources: [resource],
		fs: {
			readdir(fsPath, callback) {
				return callback(null, ["messagebundle_de.properties", "messagebundle_en.properties"]);
			}
		}
	});

	t.deepEqual(processedResources, [resource], "Input resource is returned");

	t.true(t.context.logWarnSpy.notCalled, "No warnings should be logged");
	t.true(t.context.logErrorSpy.notCalled, "No errors should be logged");
});

test.serial("Library: sap.ui5/library: Do not replace supportedLocales with disabled i18n feature", async (t) => {
	t.plan(3);
	const {manifestTransformer} = t.context;
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

	const processedResources = await manifestTransformer({
		resources: [resource],
		fs: {
			readdir(fsPath, callback) {
				return callback(null, ["messagebundle_de.properties", "messagebundle_en.properties"]);
			}
		}
	});

	t.deepEqual(processedResources, [undefined], "No resource is returned, because it is not changed");

	t.true(t.context.logWarnSpy.notCalled, "No warnings should be logged");
	t.true(t.context.logErrorSpy.notCalled, "No errors should be logged");
});

test.serial("Library: sap.ui5/library: Replaces supportedLocales with terminologies", async (t) => {
	t.plan(4);
	const {manifestTransformer} = t.context;
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

	const processedResources = await manifestTransformer({
		resources: [resource],
		fs: {
			readdir: sinon.stub().callsFake((fsPath, callback) => {
				if (fsPath && fsPath.endsWith("i18nc_sports")) {
					return callback(null, [
						"messagebundle.sports_de.properties",
						"messagebundle.sports_en.properties",
						"messagebundle.sports.properties"
					]);
				} else {
					return callback(null, [
						"messagebundlec_de.properties",
						"messagebundlec_en.properties",
						"messagebundlec.properties"
					]);
				}
			})
		}
	});

	t.deepEqual(processedResources, [resource], "Input resource is returned");

	t.true(t.context.logWarnSpy.notCalled, "No warnings should be logged");
	t.true(t.context.logErrorSpy.notCalled, "No errors should be logged");
});

test.serial("Library: sap.ui5/library: Replaces supportedLocales with terminologies not bundle level", async (t) => {
	t.plan(4);
	const {manifestTransformer} = t.context;
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

	const processedResources = await manifestTransformer({
		resources: [resource],
		fs: {
			readdir: sinon.stub().callsFake((fsPath, callback) => {
				if (fsPath && fsPath.endsWith("i18nc_sports")) {
					return callback(null, [
						"messagebundle.sports_de.properties",
						"messagebundle.sports_en.properties",
						"messagebundle.sports.properties"
					]);
				} else {
					t.fail("Should never be called");
				}
			})
		}
	});

	t.deepEqual(processedResources, [resource], "Input resource is returned");

	t.true(t.context.logWarnSpy.notCalled, "No warnings should be logged");
	t.true(t.context.logErrorSpy.notCalled, "No errors should be logged");
});

test.serial("Library: sap.ui5/library: Replaces supportedLocales with deactivated terminologies", async (t) => {
	t.plan(4);
	const {manifestTransformer} = t.context;
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

	const processedResources = await manifestTransformer({
		resources: [resource],
		fs: {
			readdir: sinon.stub().callsFake((fsPath, callback) => {
				if (fsPath && fsPath.endsWith("i18nc_sports")) {
					t.fail("Should never be called");
				} else {
					return callback(null, [
						"messagebundlec_de.properties",
						"messagebundlec_en.properties",
						"messagebundlec.properties"
					]);
				}
			})
		}
	});

	t.deepEqual(processedResources, [resource], "Input resource is returned");

	t.true(t.context.logWarnSpy.notCalled, "No warnings should be logged");
	t.true(t.context.logErrorSpy.notCalled, "No errors should be logged");
});

test.serial("Library: sap.ui5/library: Replaces supportedLocales with enhanceWith", async (t) => {
	t.plan(4);
	const {manifestTransformer} = t.context;
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

	const processedResources = await manifestTransformer({
		resources: [resource],
		fs: {
			readdir: sinon.stub().callsFake((fsPath, callback) => {
				if (fsPath && fsPath.endsWith("myfolder1")) {
					return callback(null, [
						"messagebundlenc1_de.properties",
						"messagebundlenc1_en.properties",
						"messagebundlenc1.properties"
					]);
				} else if (fsPath && fsPath.endsWith("myfolder2")) {
					return callback(null, [
						"messagebundlenc2_de.properties",
						"messagebundlenc2_en.properties",
						"messagebundlenc2.properties"
					]);
				} else {
					return callback(null, [
						"messagebundlec_de.properties",
						"messagebundlec_en.properties",
						"messagebundlec.properties"
					]);
				}
			})
		}
	});

	t.deepEqual(processedResources, [resource], "Input resource is returned");

	t.true(t.context.logWarnSpy.notCalled, "No warnings should be logged");
	t.true(t.context.logErrorSpy.notCalled, "No errors should be logged");
});

test.serial("Library: sap.ui5/library: Replaces supportedLocales with enhanceWith and terminologies", async (t) => {
	t.plan(4);
	const {manifestTransformer} = t.context;
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

	const processedResources = await manifestTransformer({
		resources: [resource],
		fs: {
			readdir: sinon.stub().callsFake((fsPath, callback) => {
				if (fsPath && fsPath.endsWith("myfolder1")) {
					return callback(null, [
						"messagebundlenc1_de.properties",
						"messagebundlenc1_en.properties",
						"messagebundlenc1.properties"
					]);
				} else if (fsPath && fsPath.endsWith("myfolder2")) {
					return callback(null, [
						"messagebundlenc2_de.properties",
						"messagebundlenc2_en.properties",
						"messagebundlenc2.properties"
					]);
				} else if (fsPath && fsPath.endsWith("i18nc_sports")) {
					return callback(null, [
						"messagebundle.sports_de.properties",
						"messagebundle.sports_en.properties",
						"messagebundle.sports.properties"
					]);
				} else if (fsPath && fsPath.endsWith("i18nc_sports_soccer")) {
					return callback(null, [
						"messagebundle.soccer_de.properties",
						"messagebundle.soccer_en.properties",
						"messagebundle.soccer.properties"
					]);
				} else if (fsPath && fsPath.endsWith("i18nc_sports_soccer_el")) {
					return callback(null, [
						"messagebundle.elsoccer_de.properties",
						"messagebundle.elsoccer_en.properties",
						"messagebundle.elsoccer.properties"
					]);
				} else {
					return callback(null, [
						"messagebundlec_de.properties",
						"messagebundlec_en.properties",
						"messagebundlec.properties"
					]);
				}
			})
		}
	});

	t.deepEqual(processedResources, [resource], "Input resource is returned");

	t.true(t.context.logWarnSpy.notCalled, "No warnings should be logged");
	t.true(t.context.logErrorSpy.notCalled, "No errors should be logged");
});
