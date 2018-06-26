const spawn = require('cross-spawn').spawn;
const fs = require('fs');
const path = require('path');
const tmp = require('tmp');
const resourceFactory = require("@ui5/fs").resourceFactory;

function createJSDocConfig({source, target, namespace, libraryName, version}) {
	// resolve path to the package.json to get the path to the jsdocext folder
	const jsdocext = path.normalize(__dirname);

	const config = `{
		"plugins": ["${jsdocext}/ui5/plugin.js"],
		"opts": {
			"recurse": true,
			"lenient": true,
			"template": "${jsdocext}/ui5/template",
			"ui5": {
				"saveSymbols": true
			}
		},
		"templates": {
			"ui5": {
				"variants": [ "apijson", "fullapixml", "apijs", "api.xml"],
				"version": "${version}",
				"jsapiFile": "${target}/libraries/${libraryName}.js",
				"apiJsonFolder": "${target}/dependency-apis",
				"apiJsonFile": "${target}/test-resources/${namespace}/designtime/api.json"
			}
		}
	}`;
	console.log(config);
	return config;
}

function jsdoc({sources, target, namespace, libraryName, version}) {

	const tmpobj = tmp.fileSync();
	fs.writeFileSync(tmpobj.name, createJSDocConfig({target, namespace, libraryName, version}), 'utf8'); // TODO async + promise

	console.log("jsdoc called for ", sources);
	var args = [
		require.resolve("jsdoc/jsdoc"),
		'-c',
		tmpobj.name,
		'--verbose'
	];
	args = args.concat(sources);

	return new Promise((resolve, reject) => {
	    const child = spawn('node', args);
	    child.stdout.on('data', function(data) {
	    	console.log(String(data));
	    });
	    child.stderr.on('data', function(data) {
	        console.error(String(data));
	    });
	    child.on('exit', function(code) {
	        var resolvedDest;
	        console.log("jsdoc exited with code ", code);
	        if (code === 0 || code === 1) {
	            resolve(code);
	        } else {
	            reject(code)
	        }
	    });
	});
}

/**
 * Creates *-dbg.js files for all JavaScript-resources supplied and writes them to target locator.
 *
 * @module build/processors/dbg
 *
 * @param      {Object}  					parameters					Parameters
 * @param      {Array}						parameters.resources		List of resources to be processed
 * @param      {ResourceLocatorCollection}	parameters.sourceLocator	Source locator
 * @param      {ResourceLocator}			parameters.targetLocator	Target locator
 * @param      {Object}						[parameters.config]			Configuration
 * @return     {Promise}  Promise resolving with undefined once data has been written to the target locator
 */
module.exports = function({resources, options}) {
	if ( !options.libraryName ) {
		throw new TypeError("Cannot execute JSDoc build without a library name");
	}
	const namespace = options.libraryName.replace(/\./g, "/");
	const tmpDirObj = tmp.dirSync();
	const tmpSourceDir = path.join(tmpDirObj.name, 'src');
	const tmpTargetDir = path.join(tmpDirObj.name, 'target');

	const fsSources = resourceFactory.createAdapter({
		fsBasePath: tmpSourceDir,
		virBasePath: "/resources/"
	});
	const fsTarget = resourceFactory.createAdapter({
		fsBasePath: tmpTargetDir,
		virBasePath: "/"
	});

	//return Promise.resolve([]);

	return Promise.all(
		// write all resources to the tmp folder
		resources.map((resource) => fsSources.write(resource))
		// after this step, a follow-up step aborts silenty for an unknown reasons
		// cloning the resources before writing them avoids the problem:
		// resources.map((resource) => resource.clone().then((resource) => fsSources.write(resource)))
	).then(() => [], (err) => {
		console.log(err);
		return [];
	}).then((files) => {
		return jsdoc({
			sources: [tmpSourceDir],
			target: tmpTargetDir,
			namespace,
			libraryName: options.libraryName,
			version: options.version
		});
	}).then(() => {
		// create resources from the output files
		return Promise.all([
			fsTarget.byPath(`/test-resources/${namespace}/designtime/api.json`)
			//,fsTarget.byPath(`/libraries/${options.libraryName}.js`)
		]).then((res) => res.filter($=>$));
	}).then((result) => {
		// TODO cleanup tmp dir
		return result;
	});
};
