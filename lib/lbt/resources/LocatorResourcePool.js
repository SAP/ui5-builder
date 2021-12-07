const ResourcePool = require("./ResourcePool");
const LocatorResource = require("./LocatorResource");

class LocatorResourcePool extends ResourcePool {
	constructor({ignoreMissingModules, stripDbg} = {}) {
		super({ignoreMissingModules});
		this._stripDbg = !!stripDbg;
	}
	prepare(resources) {
		resources = resources.filter( (res) => !res.getStatInfo().isDirectory() );
		return Promise.all(
			resources.map(
				(resource) => this.addResource( new LocatorResource(this, resource, this._stripDbg) )
			).filter(Boolean)
		);
	}
}

module.exports = LocatorResourcePool;
