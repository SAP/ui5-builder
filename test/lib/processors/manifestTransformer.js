import test from "ava";
import sinon from "sinon";
import esmock from "esmock";

test.beforeEach(async (t) => {
	t.context.logWarnSpy = sinon.spy();
	t.context.logVerboseSpy = sinon.spy();
	const loggerStub = {
		warn: t.context.logWarnSpy,
		verbose: t.context.logVerboseSpy
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

test.serial("Replaces supportedLocales with existing locales", async (t) => {
	t.plan(2);
	const {manifestTransformer} = t.context;
	const input = `
{
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
}`;

	const expected = `
{
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
					"supportedLocales": ["en", "de"],
					"fallbackLocale": "de"
				}
			}
		}
	}
}`;


	const resource = {
		getString: () => Promise.resolve(input),
		setString: (actual) => {
			t.deepEqual(actual, expected, "Correct file content should be set");
		}
	};

	const processedResources = await manifestTransformer({
		resources: [resource],
		options: {
			noop: "Noop"
		}
	});

	t.deepEqual(processedResources, [resource], "Input resource is returned");

	t.true(t.context.logWarnSpy.notCalled, "No warnings should be logged");
});
