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
				info.compressedSize = 512;
			}
			return {info, buffer: async () => name.padStart(2048, "*")};
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

test("AutoSplitter with numberOfParts 1", async (t) => {
	const pool = createMockPool(["mydep"]);
	const autoSplitter = new AutoSplitter(pool, new BundleResolver(pool));
	const bundleDefinition = {
		name: `Component-preload.js`,
		defaultFileTypes: [".js", ".fragment.xml", ".view.xml", ".properties", ".json"],
		sections: [{
			mode: "preload",
			filters: ["a.js", "b.json"],
			resolve: false,
			resolveConditional: false,
			renderer: false
		}]
	};
	const oResult = await autoSplitter.run(bundleDefinition, {numberOfParts: 1});
	t.is(oResult.length, 1, "There should be only one part created since numberOfParts option is 1");
	t.deepEqual(oResult[0], {
		name: `Component-preload-0.js`,
		sections: [{
			mode: "preload",
			filters: ["a.js", "b.json"],
			name: undefined
		}]
	});
});

test("AutoSplitter with numberOfParts 2", async (t) => {
	const pool = createMockPool(["a.js", "b.json"]);
	const autoSplitter = new AutoSplitter(pool, new BundleResolver(pool));
	const bundleDefinition = {
		name: `Component-preload.js`,
		defaultFileTypes: [".js", ".fragment.xml", ".view.xml", ".properties", ".json"],
		sections: [{
			mode: "preload",
			filters: ["a.js", "b.json", "x.view.xml"],
			resolve: false,
			resolveConditional: false,
			renderer: false,
			modules: ["a.js", "b.json", "x.view.xml"]
		}, {
			mode: "preload",
			filters: ["c.js", "c.properties"],
			resolve: false,
			resolveConditional: false,
			renderer: false,
			modules: ["c.js", "c.properties"]
		}, {
			mode: "provided"
		}, {
			mode: "raw",
			modules: ["a.js", "b.json"],
			filters: ["a.js", "b.json"],
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
	t.is(oResult.length, 2, "2 parts expected");
	t.deepEqual(oResult[0], {
		name: `Component-preload-0.js`,
		sections: [{
			mode: "preload",
			filters: ["a.js"],
			name: undefined
		}],
		configuration: {}
	}, "first part should contain only a.js since its size is only 2048");
	t.deepEqual(oResult[1], {
		name: `Component-preload-1.js`,
		sections: [{
			mode: "preload",
			filters: ["b.json", "x.view.xml"],
			name: undefined
		}, {
			mode: "preload",
			filters: ["c.js", "c.properties"],
			name: undefined
		}, {
			declareRawModules: undefined,
			mode: "raw",
			filters: [],
			sort: undefined
		}, {
			mode: "require",
			filters: ["a.js", "c.js"]
		}]
	}, "second part should contain the other resources");
});
