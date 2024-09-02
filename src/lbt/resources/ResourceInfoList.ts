import ResourceInfo from "./ResourceInfo.js";

const DEBUG_RESOURCES_PATTERN = /-dbg((?:\.view|\.fragment|\.controller|\.designtime|\.support)?\.js|\.css)$/;

/**
 * A list of ResourceInfo objects, suitable for (but not dependent on) JSON serialization.
 *
 * @author Frank Weigel
 * @since 1.33.0
 */
class ResourceInfoList {
	/**
	 * Holds ResourceInfos
	 *
	 * @param prefix
	 */
	constructor(prefix: string) {
		/**
		 * List of resources information objects
		 *
		 */
		this.resources = [];

		// --- transient state ---
		/**
		 * The name of the resource
		 *
		 */
		this.name = prefix;
		/**
		 *
		 */
		this.resourcesByName = new Map();
	}

	/**
	 * Add ResourceInfo to list
	 *
	 * @param info
	 */
	add(info: ResourceInfo) {
		const relativeName = ResourceInfoList.makePathRelativeTo(this.name, info.name);
		// search for a resource with the same name
		let myInfo = this.resourcesByName.get(relativeName);

		// this is the assumption, that the debug one is the same as the non-dbg one
		if (myInfo == null) {
			myInfo = new ResourceInfo(relativeName);
			myInfo.size = info.size;
			this.resources.push(myInfo);
			this.resourcesByName.set(relativeName, myInfo);
		}
		myInfo.copyFrom(this.name, info);
		if (info.i18nName) {
			myInfo.i18nName = ResourceInfoList.makePathRelativeTo(this.name, info.i18nName);
		}
	}

	/**
	 * Serializes its content to JSON format
	 *
	 * @returns
	 */
	toJSON() {
		this.resources.sort((a, b) => {
			if (a.name === b.name) {
				return 0;
			}
			return a.name < b.name ? -1 : 1;
		});
		return {
			/**
			 * Version of the resources.json file format, must be 1.1.0 or higher to store dependencies
			 */
			_version: "1.1.0",
			resources: this.resources,
		};
	}

	/**
	 * Retrieves the relative path
	 *
	 * @param prefix
	 * @param name
	 * @returns
	 */
	static makePathRelativeTo(prefix: string, name: string) {
		let back = "";
		while (!name.startsWith(prefix)) {
			const p = prefix.lastIndexOf("/", prefix.length - 2);
			back = back + "../";
			if (p >= 0) {
				prefix = prefix.slice(0, p + 1);
			} else {
				prefix = "";
				break;
			}
		}
		return back + name.slice(prefix.length);
	}

	/**
	 * If the given module is a -dbg file, calculate and return the non-dbg name.
	 *
	 * @param path
	 * @returns Non-debug name of the module
	 */
	static getNonDebugName(path: string) {
		if (DEBUG_RESOURCES_PATTERN.test(path)) {
			return path.replace(DEBUG_RESOURCES_PATTERN, "$1");
		}
		return null;
	}
}

export default ResourceInfoList;
