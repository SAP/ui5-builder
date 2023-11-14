import workerpool from "workerpool";
import {deserializeResources, FsWorkerThreadInterface, serializeResources} from "./PoolDispatcher.js";

export default async function execInThread({modulePath, methodName, args}) {
	const moduleToExecute = await import(modulePath);
	const methodCall = moduleToExecute[methodName] || moduleToExecute["default"];
	const {options, resources, fs} = args;

	const buildUpArgs = {options};

	if (resources) {
		buildUpArgs.resources = await deserializeResources(resources);
	}
	if (fs) {
		buildUpArgs.fs = new FsWorkerThreadInterface(fs);
	}

	const result = await methodCall(buildUpArgs);

	if (fs) {
		// TODO: Workaround- themeBuild. Returns resources and uses fs, but minify returns a plain object.
		return serializeResources(result);
	} else {
		return result; // TODO: Workaround- minify
	}
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
