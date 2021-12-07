const Resource = require("./Resource");
const ModuleName = require("../utils/ModuleName");

function extractName(path, stripDbg) {
	let resourceName = path.slice( "/resources/".length);
	if (stripDbg) {
		resourceName = ModuleName.getNonDebugName(resourceName) || resourceName;
	}
	return resourceName;
}

class LocatorResource extends Resource {
	constructor(pool, resource, stripDbg) {
		super(pool, extractName(resource.getPath(), stripDbg), null, resource.getStatInfo());
		this.resource = resource;
	}

	buffer() {
		return this.resource.getBuffer();
	}

	getProject() {
		return this.resource._project;
	}
}

module.exports = LocatorResource;
