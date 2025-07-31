export function createTaskUtil(t, {setTag, getTag, STANDARD_TAGS, createFilterReader} = {}) {
	const taskUtil = {
		resources: new Map(),
		setTag: setTag ? setTag : (resource, value) => {
			taskUtil.resources.set(resource.getPath(), value);
		},
		getTag: getTag ? getTag : (resource, tag) => {
			if (taskUtil.resources.size !== 0) {
				return taskUtil.resources.get(resource.getPath()) === tag;
			}
			return false;
		},
		STANDARD_TAGS: STANDARD_TAGS ? STANDARD_TAGS : {
			IsDebugVariant: "IsDebugVariant",
			HasDebugVariant: "HasDebugVariant",
			OmitFromBuildResult: "OmitFromBuildResult",
			IsBundle: "IsBundle"
		},
		resourceFactory: {
			createFilterReader: createFilterReader ?
				createFilterReader : t.context.sinon.stub().callsFake(
					({reader, callback}) => {
						return {
							byGlob: async (pattern) => {
								const resources = await reader.byGlob(pattern);
								return resources.filter(callback);
							}
						};
					}
				)
		},
		registerCleanupTask: t.context.sinon.stub(),
	};
	return taskUtil;
};
