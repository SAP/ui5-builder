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

	const resource = {
		getString: () => Promise.resolve(input),
		setString: (actual) => {
			t.fail("setString should never be called because resource should not be changed");
		}
	};

	const processedResources = await manifestTransformer({
		resources: [resource],
		fs: {
			readdir() {
				return Promise.resolve(["i18n_de.properties", "i18n_en.properties"]);
			}
		}
	});

	t.deepEqual(processedResources, [undefined], "No resource is returned, because it is not changed");

	t.true(t.context.logWarnSpy.notCalled, "No warnings should be logged");
	t.true(t.context.logErrorSpy.notCalled, "No errors should be logged");
});

test.serial("Application: sap.app/i18n (with templates, default bundle): Replaces supportedLocales with available messageproperty files", async (t) => {
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

	const resource = {
		getString: () => Promise.resolve(input),
		setString: (actual) => {
			t.deepEqual(actual, expected, "Correct file content should be set");
		}
	};

	const processedResources = await manifestTransformer({
		resources: [resource],
		fs: {
			readdir() {
				return Promise.resolve(["i18n_de.properties", "i18n_en.properties"]);
			}
		}
	});

	t.deepEqual(processedResources, [resource], "Input resource is returned");

	t.true(t.context.logWarnSpy.notCalled, "No warnings should be logged");
	t.true(t.context.logErrorSpy.notCalled, "No errors should be logged");
});

test.serial("Application: sap.app/i18n (with templates, custom bundle): Replaces supportedLocales with available messageproperty files", async (t) => {
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

	const resource = {
		getString: () => Promise.resolve(input),
		setString: (actual) => {
			t.deepEqual(actual, expected, "Correct file content should be set");
		}
	};

	const processedResources = await manifestTransformer({
		resources: [resource],
		fs: {
			readdir() {
				return Promise.resolve(["mybundle_de.properties", "mybundle_en.properties"]);
			}
		}
	});

	t.deepEqual(processedResources, [resource], "Input resource is returned");

	t.true(t.context.logWarnSpy.notCalled, "No warnings should be logged");
	t.true(t.context.logErrorSpy.notCalled, "No errors should be logged");
});

test.serial("Application: sap.ui5/models: Replaces supportedLocales with available messageproperty files", async (t) => {
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

	const resource = {
		getString: () => Promise.resolve(input),
		setString: (actual) => {
			t.deepEqual(actual, expected, "Correct file content should be set");
		}
	};

	const processedResources = await manifestTransformer({
		resources: [resource],
		fs: {
			readdir() {
				return Promise.resolve(["i18n_de.properties", "i18n_en.properties"]);
			}
		}
	});

	t.deepEqual(processedResources, [resource], "Input resource is returned");

	t.true(t.context.logWarnSpy.notCalled, "No warnings should be logged");
	t.true(t.context.logErrorSpy.notCalled, "No errors should be logged");
});

test.serial("Application: sap.ui5/models: Do not replace supportedLocales when supportedLocales are already defined", async (t) => {
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

	const resource = {
		getString: () => Promise.resolve(input),
		setString: (actual) => {
			t.fail("setString should never be called because resource should not be changed");
		}
	};

	const processedResources = await manifestTransformer({
		resources: [resource],
		fs: {
			readdir() {
				return Promise.resolve(["i18n_de.properties", "i18n_en.properties"]);
			}
		}
	});

	t.deepEqual(processedResources, [undefined], "No resource is returned, because it is not changed");
	t.true(t.context.logWarnSpy.notCalled, "No warnings should be logged");
	t.true(t.context.logErrorSpy.notCalled, "No errors should be logged");
});

test.serial("Application: sap.ui5/models: Do not replace supportedLocales when supportedLocales are set to array with empty string", async (t) => {
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

	const resource = {
		getString: () => Promise.resolve(input),
		setString: (actual) => {
			t.fail("setString should never be called because resource should not be changed");
		}
	};

	const processedResources = await manifestTransformer({
		resources: [resource],
		fs: {
			readdir() {
				return Promise.resolve(["i18n_de.properties", "i18n_en.properties"]);
			}
		}
	});

	t.deepEqual(processedResources, [undefined], "No resource is returned, because it is not changed");
	t.true(t.context.logWarnSpy.notCalled, "No warnings should be logged");
	t.true(t.context.logErrorSpy.notCalled, "No errors should be logged");
});

test.serial("Application: sap.ui5/models: Log error, no supportedLocales generation if fallbackLocale is not part of generation", async (t) => {
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

	const resource = {
		getString: () => Promise.resolve(input),
		setString: (actual) => {
			t.deepEqual(actual, expected, "Correct file content should be set");
		}
	};

	const processedResources = await manifestTransformer({
		resources: [resource],
		fs: {
			readdir() {
				return Promise.resolve(["i18n_de.properties", "i18n_en.properties"]);
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

test.serial("Application: sap.ui5/models: Log warning, but generate locales if default fallbackLocale is not part of generation", async (t) => {
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

	const resource = {
		getString: () => Promise.resolve(input),
		setString: (actual) => {
			t.deepEqual(actual, expected, "Correct file content should be set");
		}
	};

	const processedResources = await manifestTransformer({
		resources: [resource],
		fs: {
			readdir() {
				return Promise.resolve(["i18n_de.properties", "i18n_fr.properties"]);
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

	const resource = {
		getString: () => Promise.resolve(input),
		setString: (actual) => {
			t.fail("setString should never be called because resource should not be changed");
		}
	};

	const processedResources = await manifestTransformer({
		resources: [resource],
		fs: {
			readdir() {
				return Promise.resolve(["i18n_de.properties", "i18n_en.properties"]);
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

	const resource = {
		getString: () => Promise.resolve(input),
		setString: (actual) => {
			t.fail("setString should never be called because resource should not be changed");
		}
	};

	const processedResources = await manifestTransformer({
		resources: [resource],
		fs: {
			readdir() {
				return Promise.resolve(["i18n_de.properties", "i18n_en.properties"]);
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

	const resource = {
		getString: () => Promise.resolve(input),
		setString: (actual) => {
			t.fail("setString should never be called because resource should not be changed");
		}
	};

	const processedResources = await manifestTransformer({
		resources: [resource],
		fs: {
			readdir() {
				return Promise.resolve(["i18n_de.properties", "i18n_en.properties"]);
			}
		}
	});

	t.deepEqual(processedResources, [undefined], "No resource is returned, because it is not changed");

	t.true(t.context.logWarnSpy.notCalled, "No warnings should be logged");
	t.true(t.context.logErrorSpy.notCalled, "No errors should be logged");
});

test.serial("Library: sap.app/i18n (with templates, no bundle defined): No generation of supportedLocales when no bundleUrl is given", async (t) => {
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

	const resource = {
		getString: () => Promise.resolve(input),
		setString: (actual) => {
			t.fail("setString should never be called because resource should not be changed");
		}
	};

	const processedResources = await manifestTransformer({
		resources: [resource],
		fs: {
			readdir() {
				return Promise.resolve(["i18n_de.properties", "i18n_en.properties"]);
			}
		}
	});

	t.deepEqual(processedResources, [undefined], "Input resource is returned");

	t.true(t.context.logWarnSpy.notCalled, "No warnings should be logged");
	t.true(t.context.logErrorSpy.notCalled, "No errors should be logged");
});

test.serial("Library: sap.app/i18n (with custom bundle): Replaces supportedLocales with available messageproperty files", async (t) => {
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

	const resource = {
		getString: () => Promise.resolve(input),
		setString: (actual) => {
			t.deepEqual(actual, expected, "Correct file content should be set");
		}
	};

	const processedResources = await manifestTransformer({
		resources: [resource],
		fs: {
			readdir() {
				return Promise.resolve(["mybundle_de.properties", "mybundle_en.properties"]);
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

	const resource = {
		getString: () => Promise.resolve(input),
		setString: (actual) => {
			t.deepEqual(actual, expected, "Correct file content should be set");
		}
	};

	const processedResources = await manifestTransformer({
		resources: [resource],
		fs: {
			readdir() {
				return Promise.resolve(["messagebundlec_de.properties", "messagebundlec_en.properties"]);
			}
		}
	});

	t.deepEqual(processedResources, [resource], "Input resource is returned");

	t.true(t.context.logWarnSpy.notCalled, "No warnings should be logged");
	t.true(t.context.logErrorSpy.notCalled, "No errors should be logged");
});

test.serial("Library: sap.ui5/library: Replaces supportedLocales with available messageproperty files (i18n=true)", async (t) => {
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

	const resource = {
		getString: () => Promise.resolve(input),
		setString: (actual) => {
			t.deepEqual(actual, expected, "Correct file content should be set");
		}
	};

	const processedResources = await manifestTransformer({
		resources: [resource],
		fs: {
			readdir() {
				return Promise.resolve(["messagebundle_de.properties", "messagebundle_en.properties"]);
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

	const resource = {
		getString: () => Promise.resolve(input),
		setString: () => {
			t.fail("setString should never be called because resource should not be changed");
		}
	};

	const processedResources = await manifestTransformer({
		resources: [resource],
		fs: {
			readdir() {
				return Promise.resolve(["messagebundle_de.properties", "messagebundle_en.properties"]);
			}
		}
	});

	t.deepEqual(processedResources, [undefined], "No resource is returned, because it is not changed");

	t.true(t.context.logWarnSpy.notCalled, "No warnings should be logged");
	t.true(t.context.logErrorSpy.notCalled, "No errors should be logged");
});
