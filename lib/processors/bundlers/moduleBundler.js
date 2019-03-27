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
 * A ModuleBundleDefinitionSection specifies the embedding technology ('provided', 'raw', 'preload' or 'require')
 * and lists the resources that should be in- or excluded from the section.
 * <p>
 * <b>Module bundle section modes</b><br>
 * <ul>
 * 	<li>
 * 		<code>provided</code>: A section of type 'provided' defines a set of modules that should not be included in the bundle file itself, but
			which should be assumed to be already loaded (or 'provided') by the environment into which bundle module is loaded.
 * 	</li>
 *	<li>
		 <code>raw</code>: A raw section determines the set of modules that should be embedded,
			sorts them according to their dependencies and writes them out 1:1 without any transformation or wrapping (raw). Only JavaScript sources
				can be embedded in a raw section.
	</li>
 *	<li>
		 <code>preload</code>: A preload section packages resources that should be stored in the preload cache in the client.
			They can embed any textual resource type (JavaScript, CSS and Theme-Parameter files) that the bundling supports. The modules are wrapped into a call to jQuery.sap.registerPreload()
				and each Javascript module will be embedded in an anonymous function.
	</li>
 *	<li>
		 <code>require</code>: A require section is transformed into a sequence of jQuery.sap.require calls. It only has text content, no nested options.
			The text content must contain a comma or whitespace separated list of module names or patterns. The list will be resolved like an include pattern list
				in any of the other sections and for each of the resolved modules, a jQuery.sap.require will be created.
	</li>
 * </ul>
 * </p>
 *
 * @public
 * @typedef {object} ModuleBundleDefinitionSection
 * @property {string} mode The embedding technology. Either 'provided', 'raw', 'preload' or 'require'
 * @property {string[]} filters List of modules declared as glob patterns that should be in- or exluded.
 * 		Exludes should be marked with a leading exclamation mark.
 * @property {boolean} [renderer=false] Whether renderers for controls should be added to the module set
 * @property {boolean} [resolve=false] Whether (transitive) dependencies of module should be resolved
 * 		and added to the module set
 * @property {boolean} [resolveConditional=false] Whether conditional dependencies of modules should be resolved
 * 		and added to the module set for this section
 * @property {boolean} [sort=true] Whether the modules should be sorted by their dependencies
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
 * @param {string[]} [parameters.options.bundleDefinition.defaultFileTypes=[".js", ".fragment.xml", ".view.xml", ".properties", ".json"]] List of default file types to be included in the bundle
 * @param {ModuleBundleDefinitionSection[]} parameters.options.bundleDefinition.sections List of module bundle definition sections.
 * @param {Object} parameters.options.bundleOptions Module bundle options
 * @param {boolean} [parameters.options.bundleOptions.optimize=false] If set to 'true' the module bundle gets minified
 * @param {boolean} [parameters.options.bundleOptions.usePredefineCalls=false] If set to 'true', sap.ui.predefine is used for UI5 modules
 * @param {boolean} [parameters.options.bundleOptions.decorateBootstrapModule=true] If set to 'false', the module won't be decorated with an optimization marker
 * @param {boolean} [parameters.options.bundleOptions.addTryCatchRestartWrapper=false] Whether to wrap bootable module bundles with a try/catch to filter out "Restart" errors
 * @param {number} [parameters.options.bundleOptions.numberOfParts=1] The number of parts the module bundle should be splitted
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
