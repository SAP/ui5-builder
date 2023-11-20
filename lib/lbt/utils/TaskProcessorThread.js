import workerpool from "workerpool";
import {FsWorkerThreadInterface, deserializeResources, serializeData, deserializeData} from "./PoolDispatcher.js";

export default async function execInThread({modulePath, methodName, args}) {
	const moduleToExecute = await import(modulePath);
	const methodCall = moduleToExecute[methodName] || moduleToExecute["default"];
	const {options, resources, fs} = args;

	const buildUpArgs = {options: await deserializeData(options)};

	if (resources) {
		buildUpArgs.resources = await deserializeResources(resources);
	}
	if (fs) {
		buildUpArgs.fs = new FsWorkerThreadInterface(fs);
	}

	const result = await methodCall(buildUpArgs);

	return serializeData(result);
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
