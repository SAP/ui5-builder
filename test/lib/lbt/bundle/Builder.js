const {test} = require("ava");

const Builder = require("../../../../lib/lbt/bundle/Builder");
const ResourcePool = require("../../../../lib/lbt/resources/ResourcePool");


test("createBundle EVOBundleFormat", async (t) => {
	const pool = new ResourcePool();
	pool.addResource({
		name: "ui5loader.js",
		buffer: async () => ""
	});
	pool.addResource({
		name: "jquery.sap.global-dbg.js",
		buffer: async () => ""
	});

	const bundleDefinition = {
		name: `Component-preload.js`,
		defaultFileTypes: [".js"],
		sections: [{
			mode: "preload",
			filters: ["sap-ui-core.js", "jquery.sap.global-dbg.js"],
			name: "myname"
		}, {
			declareRawModules: undefined,
			mode: "raw",
			filters: ["sap-ui-core.js", "jquery.sap.global-dbg.js"],
			sort: undefined
		}, {
			mode: "require",
			filters: ["sap-ui-core.js", "jquery.sap.global-dbg.js"]
		}]
	};

	const builder = new Builder(pool);
	const oResult = await builder.createBundle(bundleDefinition, {numberOfParts: 1, decorateBootstrapModule: true});
	t.is(oResult.name, "Component-preload.js");
	t.is(oResult.content, `sap.ui.require.preload({
	"jquery.sap.global-dbg.js":function(){
}
});
sap.ui.requireSync("jquery.sap.global-dbg");
`);
	t.is(oResult.bundleInfo.name, "Component-preload.js");
	t.is(oResult.bundleInfo.size, 116);
	t.deepEqual(oResult.bundleInfo.subModules, ["jquery.sap.global-dbg.js"]);
});

test("createBundle UI5BundleFormat", async (t) => {
	const pool = new ResourcePool();
	pool.addResource({
		name: "ui5loader.js",
		buffer: async () => ""
	});
	pool.addResource({
		name: "jquery.sap.global-dbg.js",
		buffer: async () => ""
	});

	const bundleDefinition = {
		name: `Component-preload.js`,
		defaultFileTypes: [".js", ".fragment.xml", ".view.xml", ".properties", ".json"],
		sections: [{
			mode: "preload",
			filters: ["sap-ui-core.js", "jquery.sap.global-dbg.js"],
			name: "myname"
		}, {
			declareRawModules: undefined,
			mode: "raw",
			filters: ["sap-ui-core.js", "jquery.sap.global-dbg.js"],
			sort: undefined
		}, {
			mode: "require",
			filters: ["sap-ui-core.js", "jquery.sap.global-dbg.js"]
		}]
	};

	const builder = new Builder(pool);
	const oResult = await builder.createBundle(bundleDefinition, {numberOfParts: 1, decorateBootstrapModule: true});
	t.is(oResult.name, "Component-preload.js");
	t.is(oResult.content, `sap.ui.require.preload({
	"jquery.sap.global-dbg.js":function(){
}
});
sap.ui.requireSync("jquery.sap.global-dbg");
`);
	t.is(oResult.bundleInfo.name, "Component-preload.js");
	t.is(oResult.bundleInfo.size, 116);
	t.deepEqual(oResult.bundleInfo.subModules, ["jquery.sap.global-dbg.js"]);
});
