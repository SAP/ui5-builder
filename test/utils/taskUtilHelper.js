export function createTaskUtil(t, {setTag, getTag, STANDARD_TAGS, createFilterReader} = {}) {
	const taskUtil = {
		resources: new Map(),
		setTag: setTag ? setTag : (resource, value) => {
			const path = resource.getPath();
			const tags = taskUtil.resources.get(path) || new Set();
			tags.add(value);
			taskUtil.resources.set(path, tags);
		},
		getTag: getTag ? getTag : (resource, tag) => {
			return taskUtil.resources.get(resource.getPath())?.has(tag) || false;
		},
		STANDARD_TAGS: STANDARD_TAGS ? STANDARD_TAGS : {
			IsDebugVariant: "IsDebugVariant",
			HasDebugVariant: "HasDebugVariant",
			OmitFromBuildResult: "OmitFromBuildResult",
			IsBundle: "IsBundle"
		},
		registerCleanupTask: t.context.sinon.stub(),
	};
	return taskUtil;
};
