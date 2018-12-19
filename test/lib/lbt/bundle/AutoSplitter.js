const {test} = require("ava");

const BundleResolver = require("../../../../lib/lbt/bundle/Resolver");
const AutoSplitter = require("../../../../lib/lbt/bundle/AutoSplitter");

const ModuleInfo = require("../../../../lib/lbt/resources/ModuleInfo");

function createMockPool(dependency) {
	return {
		async findResourceWithInfo(name) {
			const info = new ModuleInfo(name);
			info.addDependency(dependency);
			return {info};
		},
		resources: []
	};
}

test("AutoSplitter 1 part", async (t) => {
	const pool = createMockPool("mydep");
	const autoSplitter = new AutoSplitter(pool, new BundleResolver(pool));
	const bundleDefinition = {
		name: `Component-preload.js`,
		defaultFileTypes: [".js", ".fragment.xml", ".view.xml", ".properties", ".json"],
		sections: [{
			mode: "preload",
			filters: [],
			resolve: false,
			resolveConditional: false,
			renderer: false
		}]
	};
	const oResult = await autoSplitter.run(bundleDefinition, {});
	t.is(oResult.length, 1);
	t.deepEqual(oResult[0], {
		name: `Component-preload-0.js`,
		sections: [{
			mode: "preload",
			filters: [],
			name: undefined
		}]
	});
});

test("AutoSplitter 2 parts", async (t) => {
	const pool = createMockPool("mydep");
	const autoSplitter = new AutoSplitter(pool, new BundleResolver(pool));
	const bundleDefinition = {
		name: `Component-preload.js`,
		defaultFileTypes: [".js", ".fragment.xml", ".view.xml", ".properties", ".json"],
		sections: [{
			mode: "preload",
			filters: [],
			resolve: false,
			resolveConditional: false,
			renderer: false,
			modules: ["a", "b"]
		}, {
			mode: "Provided"
		}, {
			mode: "Raw",
			modules: ["a", "b"],
			sectionDefinition: {
				declareRawModules: [],
				sort: false
			}
		}, {
			mode: "Require",
			modules: ["a", "b"]
		}]
	};
	const oResult = await autoSplitter.run(bundleDefinition, {numberOfParts: 2});
	t.is(oResult.length, 1);
	t.deepEqual(oResult[0], {
		name: `Component-preload-0.js`,
		sections: [{
			mode: "preload",
			filters: [],
			name: undefined
		}]
	});
});
