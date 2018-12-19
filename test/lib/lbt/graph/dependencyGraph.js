const {test} = require("ava");

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

test("dependency graph", async (t) => {
	const pool = createMockPool("mydep");
	const roots = [{
		name: "myroot"
	}];
	const oResult = await dependencyGraph(pool, roots);
	t.deepEqual(Array.from(oResult.nodes.keys()), ["", "myroot", "mydep"]);

	const empty = oResult.nodes.get("");
	t.is(empty.name, "");
	t.false(empty.visited);
	const myroot = oResult.nodes.get("myroot");
	t.is(myroot.name, "myroot");
	t.true(myroot.visited);
	const mydep = oResult.nodes.get("mydep");
	t.is(mydep.name, "mydep");
	t.true(mydep.visited);
});

test("dependency with visited nodes", async (t) => {
	const pool = createMockPool("mydep");
	const roots = [{
		name: "myroot"
	}, {
		name: "mydep"
	}];
	const oResult = await dependencyGraph(pool, roots);
	t.deepEqual(Array.from(oResult.nodes.keys()), ["", "myroot", "mydep"]);

	const empty = oResult.nodes.get("");
	t.is(empty.name, "");
	t.false(empty.visited);
	const myroot = oResult.nodes.get("myroot");
	t.is(myroot.name, "myroot");
	t.true(myroot.visited);
	const mydep = oResult.nodes.get("mydep");
	t.is(mydep.name, "mydep");
	t.true(mydep.visited);
});

test("dependency graph with invalid pool", async (t) => {
	const pool = {async getModuleInfo(name) {
		return Promise.reject("myerror");
	}};
	const roots = [{
		name: "myroot"
	}];

	const oResult = await dependencyGraph(pool, roots);
	t.deepEqual(Array.from(oResult.nodes.keys()), ["", "myroot"]);

	const empty = oResult.nodes.get("");
	t.is(empty.name, "");
	t.false(empty.visited);
	const myroot = oResult.nodes.get("myroot");
	t.is(myroot.name, "myroot");
	t.true(myroot.visited);
});
