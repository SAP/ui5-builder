const ResourcePool = require("./resources/ResourcePool");
const LocatorResource = require("./LocatorResource");


class LocatorResourcePool extends ResourcePool {
	constructor() {
		super();
	}

	prepare(resources) {
		resources = resources.filter( (res) => !res.getStatInfo().isDirectory() );
		// console.log(resources.map($ => $.getPath()));
		return Promise.all(
			resources.map(
				(resource) => this.addResource( new LocatorResource(this, resource) )
			).filter(Boolean)
		);
		// .then( () => {
		// 	console.log("  found %d resources", this.size);
		// });
	}
}

module.exports = LocatorResourcePool;
