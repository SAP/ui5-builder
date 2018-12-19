const {test} = require("ava");

const topologicalSort = require("../../../../lib/lbt/graph/topologicalSort");

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
	const roots = ["myroot", "mydep"];
	const topologicalSortResult = await topologicalSort(pool, roots);
	t.deepEqual(topologicalSortResult, ["mydep", "myroot"]);
});


test("cyclic dependencies", async (t) => {
	const pool = {
		async getModuleInfo(name) {
			const info = new ModuleInfo(name);
			if (name === "third") {
				info.addDependency("mydep", false);
			} else if (name === "mydep") {
				info.addDependency("third", false);
			}
			return info;
		}
	};
	const roots = ["myroot", "mydep", "third"];
	await topologicalSort(pool, roots).catch((err) => {
		t.is(err.message, "failed to resolve cyclic dependencies: mydep,third");
	});
});
