const {test} = require("ava");

const BundleResolver = require("../../../../lib/lbt/bundle/Resolver");
const AutoSplitter = require("../../../../lib/lbt/bundle/AutoSplitter");

const ModuleInfo = require("../../../../lib/lbt/resources/ModuleInfo");

function createMockPool(dependencies) {
	return {
		async findResourceWithInfo(name) {
			const info = new ModuleInfo(name);
			dependencies.forEach((dependency) => {
				info.addDependency(dependency);
			});
			if (name === "c.js") {
				info.compressedSize = 10;
			}
			return {info, buffer: () => name};
		},
		resources: [{
			name: "a.js"
		}, {
			name: "c.js"
		}, {
			name: "b.json"
		}, {
			name: "x.view.xml"
		}, {
			name: "c.properties"
		}]
	};
}

test("AutoSplitter 1 part", async (t) => {
	const pool = createMockPool(["mydep"]);
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
	const pool = createMockPool(["a.js", "b.json"]);
	const autoSplitter = new AutoSplitter(pool, new BundleResolver(pool));
	const bundleDefinition = {
		name: `Component-preload.js`,
		defaultFileTypes: [".js", ".fragment.xml", ".view.xml", ".properties", ".json"],
		sections: [{
			mode: "preload",
			filters: ["a.js", "c.js", "b.json", "c.properties", "x.view.xml"],
			resolve: false,
			resolveConditional: false,
			renderer: false,
			modules: ["a.js", "c.js", "b.json", "c.properties", "x.view.xml"]
		}, {
			mode: "provided"
		}, {
			mode: "raw",
			modules: ["a.js", "c.js", "b.json"],
			filters: ["a.js", "c.js", "b.json"],
			sectionDefinition: {
				declareRawModules: [],
				sort: false
			}
		}, {
			mode: "require",
			filters: ["a.js", "c.js"],
			modules: ["a.js", "c.js"]
		}],
		configuration: {}
	};
	const oResult = await autoSplitter.run(bundleDefinition, {numberOfParts: 2, optimize: false});
	t.is(oResult.length, 1);
	t.deepEqual(oResult[0], {
		name: `Component-preload-0.js`,
		sections: [{
			mode: "preload",
			filters: ["a.js", "c.js", "b.json", "x.view.xml", "c.properties"],
			name: undefined
		}, {
			declareRawModules: undefined,
			mode: "raw",
			filters: [],
			sort: undefined
		}, {
			mode: "require",
			filters: ["a.js", "c.js"]
		}],
		configuration: {}
	});
});
