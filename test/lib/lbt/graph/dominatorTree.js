const {test} = require("ava");

const dominatorTree = require("../../../../lib/lbt/graph/dominatorTree");
const dependencyGraph = require("../../../../lib/lbt/graph/dependencyGraph");

const ModuleInfo = require("../../../../lib/lbt/resources/ModuleInfo");

function createMockPool(dependency) {
	return {
		async getModuleInfo(name) {
			const info = new ModuleInfo(name);
			info.addDependency(dependency);
			return info;
		}
	};
}

test("dominator tree", async (t) => {
	const pool = createMockPool("mydep");
	const roots = [{
		name: "myroot"
	}];
	const oDependencyGraph = await dependencyGraph(pool, roots);
	const oResult = dominatorTree(oDependencyGraph);
	t.is(oResult.name, "");
});
