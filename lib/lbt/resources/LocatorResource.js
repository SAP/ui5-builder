const Resource = require("./Resource");

function extractName(path) {
	return path.slice( "/resources/".length);
}

class LocatorResource extends Resource {
	constructor(pool, resource, realResourcePath) {
		super(pool, extractName(resource.getPath()), null, resource.getStatInfo());
		this.resource = resource;
		this._realResourcePath = extractName(realResourcePath || resource.getPath());
	}

	buffer() {
		return this.resource.getBuffer();
	}

	getProject() {
		return this.resource._project;
	}

	getRealResourcePath() {
		return this._realResourcePath;
	}
}

module.exports = LocatorResource;
