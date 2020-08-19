const ResourceInfo = require("./ResourceInfo");

const DEBUG_RESOURCES_PATTERN = /-dbg((?:\.view|\.fragment|\.controller|\.designtime|\.support)?\.js|\.css)$/;
const RESOURCES_PATTERN = /((?:\.view|\.fragment|\.controller|\.designtime|\.support)?\.js|\.css)$/;

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
	 * @param {string} prefix
	 */
	constructor(prefix) {
		/**
		 * List of resources information objects
		 *
		 * @type {ResourceInfo[]}
		 */
		this.resources = [];

		// --- transient state ---
		/**
		 * @type {string} name of the resource
		 */
		this.name = prefix;
		/**
		 *
		 * @type {Map<string, ResourceInfo>}
		 */
		this.resourcesByName = new Map();
	}

	/**
	 * Add ResourceInfo to list
	 *
	 * @param {ResourceInfo} info
	 * @param {boolean} shareDebugInformation
	 */
	add(info, shareDebugInformation=true) {
		const relativeName = ResourceInfoList.makePathRelativeTo(this.name, info.name);

		// search for a resource with the same name
		let myInfo = this.resourcesByName.get(relativeName);

		if ( myInfo == null && shareDebugInformation) {
			// when not found, check if the given resource is a debug resource and
			// share the information with the non-dbg version
			const nonDbgName = ResourceInfoList.getNonDebugName(relativeName);
			const dbgName = ResourceInfoList.getDebugName(relativeName);
			if ( nonDbgName != null && this.resourcesByName.has(nonDbgName) ) {
				// copy from source
				myInfo = new ResourceInfo(relativeName);
				const source = this.resourcesByName.get(nonDbgName);
				myInfo.copyFrom(this.name, source);
				this.resources.push(myInfo);
				this.resourcesByName.set(relativeName, myInfo);
			} else if (dbgName != null && this.resourcesByName.has(dbgName)) {
				// copy from debug
				myInfo = new ResourceInfo(relativeName);
				const source = this.resourcesByName.get(dbgName);
				myInfo.copyFrom(this.name, source);
				myInfo.module = ResourceInfoList.getNonDebugName(source.module);
				this.resources.push(myInfo);
				this.resourcesByName.set(relativeName, myInfo);
			}
		}

		// this is the assumption, that the debug one is the same as the non-dbg one
		if ( myInfo == null ) {
			myInfo = new ResourceInfo(relativeName);
			myInfo.size = info.size;
			myInfo.module = ResourceInfoList.getNonDebugName(info.name);
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
	 * @returns {{resources: ResourceInfo[], _version: string}}
	 */
	toJSON() {
		this.resources.sort((a, b) => {
			if ( a.name === b.name ) {
				return 0;
			}
			return a.name < b.name ? -1 : 1;
		});
		return {
			/**
			 * Version of the resources.json file format, must be 1.1.0 or higher to store dependencies
			 */
			_version: "1.1.0",
			resources: this.resources
		};
	}

	/**
	 * Retrieves the relative path
	 *
	 * @param {string} prefix
	 * @param {string} name
	 * @returns {string}
	 */
	static makePathRelativeTo(prefix, name) {
		let back = "";
		while ( !name.startsWith(prefix) ) {
			const p = prefix.lastIndexOf("/", prefix.length - 2);
			back = back + "../";
			if ( p >= 0 ) {
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
	 * @param {string} path
	 * @returns {string|null} Non-debug name of the module
	 */
	static getNonDebugName(path) {
		if ( DEBUG_RESOURCES_PATTERN.test(path) ) {
			return path.replace( DEBUG_RESOURCES_PATTERN, "$1");
		}
		return null;
	}

	static getDebugName(path) {
		if ( RESOURCES_PATTERN.test(path) ) {
			if (!path.replace(RESOURCES_PATTERN, "").endsWith("-dbg")) {
				return path.replace( RESOURCES_PATTERN, "-dbg$1");
			}
		}
		return null;
	}
}

module.exports = ResourceInfoList;
