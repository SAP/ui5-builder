const ResourcePool = require("./ResourcePool");
const LocatorResource = require("./LocatorResource");

class LocatorResourcePool extends ResourcePool {
	prepare(resources, moduleNameMapping) {
		resources = resources.filter( (res) => !res.getStatInfo().isDirectory() );
		return Promise.all(
			resources.map((resource) => {
				const moduleName = moduleNameMapping && moduleNameMapping[resource.getPath()] ||
					resource.getPath().slice("/resources/".length);
				this.addResource(new LocatorResource(this, resource, moduleName));
			}).filter(Boolean)
		);
	}
}

module.exports = LocatorResourcePool;
