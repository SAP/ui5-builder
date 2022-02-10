const Resource = require("./Resource");

function extractName(path) {
	return path.slice( "/resources/".length);
}

class LocatorResource extends Resource {
	constructor(pool, resource, sourceMappingUrl) {
		super(pool, extractName(resource.getPath()), null, resource.getStatInfo());
		this.resource = resource;
		this.sourceMappingUrl = sourceMappingUrl;
	}

	buffer() {
		return this.resource.getBuffer();
	}

	getProject() {
		return this.resource._project;
	}

	getSourceMappingUrl() {
		return this.sourceMappingUrl;
	}
}

module.exports = LocatorResource;
