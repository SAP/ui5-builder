import test from "ava";
import dominatorTree from "../../../../lib/lbt/graph/dominatorTree.js";
import dependencyGraph from "../../../../lib/lbt/graph/dependencyGraph.js";
import ModuleInfo from "../../../../lib/lbt/resources/ModuleInfo.js";

function createMockPool(dependencyMapping) {
	return {
		async getModuleInfo(name) {
			const info = new ModuleInfo(name);
			let dependencies = dependencyMapping[name];
			if (!dependencies) {
				return info;
			}
			if (!Array.isArray(dependencies)) {
				dependencies = [dependencies];
			}
			dependencies.forEach((dep) => {
				info.addDependency(dep);
			});
			return info;
		}
	};
}

function getNamesFromSet(node) {
	return Array.from(node).map((node) => node.name);
}

/**
 * Dominator Tree is currently not being used therefore the tests are simplistic
 */
test("basic dominator tree test", async (t) => {
	const pool = createMockPool({"myroot": "mydep"});
	const roots = [{
		name: "myroot"
	}];
	const graph = await dependencyGraph(pool, roots);
	const result = dominatorTree(graph);
	t.is(result.name, "");
	t.deepEqual(getNamesFromSet(result.dominators), [""], "There should be just the temp node as dominator");
	t.deepEqual(getNamesFromSet(result.pred), [], "There should be no predecessor");
	t.deepEqual(getNamesFromSet(result.succ), ["myroot"], "There should be the myroot node as successor");
});
