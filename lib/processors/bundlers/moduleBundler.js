const BundleBuilder = require("../../lbt/bundle/Builder");
const Resource = require("../../lbt/resources/Resource");
const ResourcePool = require("../../lbt/resources/ResourcePool");
const EvoResource = require("@ui5/fs").Resource;

function extractName(path) {
	return path.slice( "/resources/".length);
}

class LocatorResource extends Resource {
	constructor(pool, resource) {
		super(pool, extractName(resource.getPath()), null, resource.getStatInfo());
		this.resource = resource;
	}

	buffer() {
		return this.resource.getBuffer();
	}
}

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
			).filter( (followUp) => followUp )
		);
		// .then( () => {
		// 	console.log("  found %d resources", this.size);
		// });
	}
}

/**
 * A ModuleSection specifies the embedding technology ('provided', 'raw', 'preload' or 'require')
 * and lists the resources that should be in- or excluded from the section.
 *
 * @public
 * @alias module:@ui5/builder.processors.moduleBundler~ModuleSection
 * @typedef {object} ModuleSection
 * @property {boolean} resolve=false Whether (transitive) dependencies of module should be resolved
 * 		and added to the module set
 * @property {boolean} resolveConditional Whether conditional dependencies of modules should be resolved
 * 		and added to the module set for this section
 * @property {boolean} renderer=false Whether renderers for controls should be added to the module set
 * @property {boolean} sort=true Whether the modules should be sorted by their dependencies
 * @property {string} mode The embedding technology. Either 'provided', 'raw', 'preload' or 'require'
 * @property {string[]} filters List of modules that should be in- or exluded
 */

/**
 * Legacy preload bundler.
 *
 * @public
 * @alias module:@ui5/builder.processors.moduleBundler
 * @param {Object} parameters Parameters
 * @param {module:@ui5/fs.Resource[]} parameters.resources Resources
 * @param {Object} parameters.options Options
 * @param {Object} parameters.options.bundleDefinition Module bundle definition
 * @param {string} parameters.options.bundleDefinition.name The module bundle name
 * @param {string[]} parameters.options.bundleDefinition.defaultFileTypes List of default file types to be included in the bundle
 * @param {ModuleSection[]} parameters.options.bundleDefinition.sections List of module sections.
 * @param {Object} parameters.options.bundleOptions Module bundle options
 * @param {boolean} parameters.options.bundleOptions.optimize=false If set to 'true' the module bundle gets minified
 * @param {boolean} parameters.options.bundleOptions.usePredefineCalls=false If set to 'true', sap.ui.predefine is used for AMD compliant modules
 * @param {boolean} parameters.options.bundleOptions.decorateBootstrapModule=true If set to 'false', the module won't be decorated with an optimization marker
 * @param {boolean} parameters.options.bundleOptions.addTryCatchRestartWrapper=false Whether to wrap bootable module bundles with a try/catch to filter out "Restart" errors
 * @param {number} parameters.options.bundleOptions.numberOfParts=1 The number of parts the module bundle should be splitted
 * @returns {Promise<module:@ui5/fs.Resource[]>} Promise resolving with module bundle resources
 */
module.exports = function({resources, options}) {
//	console.log("preloadBundler bundleDefinition:");
//	console.log(JSON.stringify(options.bundleDefinition, null, 4));

	const pool = new LocatorResourcePool();
	const builder = new BundleBuilder(pool);

	const bundleOptions = options.bundleOptions || {optimize: true};

	return pool.prepare( resources ).
		then( () => builder.createBundle(options.bundleDefinition, bundleOptions) ).
		then( (results) => {
			let bundles;
			if (results instanceof Array) {
				bundles = results;
			} else {
				bundles = [results];
			}

			return Promise.all(bundles.map(function({name, content, bundleInfo}) {
				// console.log("creating bundle as '%s'", "/resources/" + name);
				const resource = new EvoResource({
					path: "/resources/" + name,
					string: content
				});
				return resource;
			}));
		});
};
