import workerpool from "workerpool";

export default async function execInThread({url, methodName, args}) {
	const moduleToRegister = await import(url);
	const methodCall = moduleToRegister[methodName] || moduleToRegister["default"];

	// return await methodCall({resources, workspace, dependencies, options});
	return await methodCall(args);
}

// Test execution via ava is never done on the main thread
/* istanbul ignore else */
if (!workerpool.isMainThread) {
	// Script got loaded through workerpool
	// => Create a worker and register public functions
	workerpool.worker({
		execInThread,
	});
}
