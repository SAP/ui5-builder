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

test.serial("Replaces supportedLocales with available messageproperty files", async (t) => {
	t.plan(4);
	const {manifestTransformer} = t.context;
	const input = JSON.stringify({
		"_version": "1.58.0",
		"sap.app": {
			"id": "sap.ui.demo.app"
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
			"id": "sap.ui.demo.app"
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
				return ["i18n_de.properties", "i18n_en.properties"];
			}
		}
	});

	t.deepEqual(processedResources, [resource], "Input resource is returned");

	t.true(t.context.logWarnSpy.notCalled, "No warnings should be logged");
	t.true(t.context.logErrorSpy.notCalled, "No errors should be logged");
});

test.serial("Do not replace supportedLocales when supportedLocales are already defined", async (t) => {
	t.plan(4);
	const {manifestTransformer} = t.context;
	const input = JSON.stringify({
		"_version": "1.58.0",
		"sap.app": {
			"id": "sap.ui.demo.app"
		},
		"sap.ui5": {
			"models": {
				"i18n": {
					"type": "sap.ui.model.resource.ResourceModel",
					"settings": {
						"bundleName": "sap.ui.demo.app.i18n.i18n",
						"supportedLocales": ["en", "fr"],
						"fallbackLocale": "de"
					}
				}
			}
		}
	}, null, 2);

	const expected = JSON.stringify({
		"_version": "1.58.0",
		"sap.app": {
			"id": "sap.ui.demo.app"
		},
		"sap.ui5": {
			"models": {
				"i18n": {
					"type": "sap.ui.model.resource.ResourceModel",
					"settings": {
						"bundleName": "sap.ui.demo.app.i18n.i18n",
						"supportedLocales": ["en", "fr"],
						"fallbackLocale": "de"
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
				return ["i18n_de.properties", "i18n_en.properties"];
			}
		}
	});

	t.deepEqual(processedResources, [resource], "Input resource is returned");
	t.true(t.context.logWarnSpy.notCalled, "No warnings should be logged");
	t.true(t.context.logErrorSpy.notCalled, "No errors should be logged");
});
