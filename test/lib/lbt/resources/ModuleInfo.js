const test = require("ava");

const ModuleInfo = require("../../../../lib/lbt/resources/ModuleInfo");

test("ModuleInfo: constructor", async (t) => {
	const moduleInfo = new ModuleInfo("myName");
	t.falsy(moduleInfo.exposedGlobals, "exposedGlobals is not set");
	t.falsy(moduleInfo.format, "format is not set");
	t.falsy(moduleInfo.description, "description is not set");
	t.false(moduleInfo.requiresTopLevelScope, "requiresTopLevelScope is false");
	t.false(moduleInfo.rawModule, "rawModule is false");
	t.false(moduleInfo.dynamicDependencies, "dynamicDependencies is false");
	t.deepEqual(moduleInfo.subModules, [], "submodules are empty");
});

test("ModuleInfo: addSubModule", async (t) => {
	// setup
	const moduleInfo = new ModuleInfo("myName");
	moduleInfo.addDependency("otherModule", false);
	const otherModuleInfo = new ModuleInfo("otherModule");
	otherModuleInfo.addDependency("unknownModule", false);
	otherModuleInfo.dynamicDependencies = true;

	// action
	moduleInfo.addSubModule(otherModuleInfo);

	// expectation
	t.true(moduleInfo.dynamicDependencies, "dynamicDependencies is set");
	t.deepEqual(moduleInfo.subModules, ["otherModule"], "submodule is set");
	t.deepEqual(moduleInfo.dependencies, ["unknownModule"], "unknownModule dependency is copied over");
});
