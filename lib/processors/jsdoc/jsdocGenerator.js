const spawn = require("child_process").spawn;
const fs = require("fs");
const path = require("path");
const {promisify} = require("util");
const writeFile = promisify(fs.writeFile);
const {resourceFactory} = require("@ui5/fs");

async function generateJsdocConfig({targetPath, namespace, libraryName, version, variants}) {
	// Resolve path to this script to get the path to the JSDoc extensions folder
	const jsdocPath = path.normalize(__dirname);

	const config = `{
		"plugins": ["${jsdocPath}/ui5/plugin.js"],
		"opts": {
			"recurse": true,
			"lenient": true,
			"template": "${jsdocPath}/ui5/template",
			"ui5": {
				"saveSymbols": true
			}
		},
		"templates": {
			"ui5": {
				"variants": ${JSON.stringify(variants)},
				"version": "${version}",
				"jsapiFile": "${targetPath}/libraries/${libraryName}.js",
				"apiJsonFolder": "${targetPath}/dependency-apis",
				"apiJsonFile": "${targetPath}/test-resources/${namespace}/designtime/api.json"
			}
		}
	}`;
	return config;
}

async function writeJsdocConfig(sourcePath, config) {
	const configPath = path.join(sourcePath, "jsdoc-config.json");
	await writeFile(configPath, config);
	return configPath;
}

async function buildJsdoc({sourcePath, configPath}) {
	const args = [
		require.resolve("jsdoc/jsdoc"),
		"-c",
		configPath,
		"--verbose",
		sourcePath
	];
	return new Promise((resolve, reject) => {
		const child = spawn("node", args, {
			stdio: ["ignore", "ignore", process.stderr]
		});
		child.on("close", function(code) {
			if (code === 0 || code === 1) {
				resolve();
			} else {
				reject(new Error(`JSDoc child process closed with code ${code}`));
			}
		});
	});
}


/**
 * JSDoc generator
 *
 * @public
 * @alias module:@ui5/builder.processors.jsdoc.jsdocGenerator
 * @param {Object} parameters Parameters
 * @param {string} parameters.sourcePath Resources
 * @param {string} parameters.targetPath Resources
 * @param {Object} parameters.options Options
 * @param {string} parameters.options.libraryName Library name
 * @param {string} parameters.options.version Library version
 * @param {Array} [parameters.options.variants=["apijson"]] JSDoc variants to be built
 * @param {boolean} [parameters.options.sdkBuild=true] Whether additional SDK specific api.json resources shall be generated
 * @returns {Promise<module:@ui5/fs.Resource[]>} Promise resolving with
 */
module.exports = async function({sourcePath, targetPath, options}) {
	if ( !options.libraryName ) {
		throw new TypeError("Cannot execute JSDoc build without a library name");
	}

	if (!options.variants || options.variants.length === 0) {
		options.variants = ["apijson"];
	}
	const namespace = options.libraryName.replace(/\./g, "/");

	const config = await generateJsdocConfig({
		targetPath,
		namespace,
		libraryName: options.libraryName,
		version: options.version,
		variants: options.variants
	});

	const configPath = await writeJsdocConfig(sourcePath, config);

	await buildJsdoc({
		sourcePath,
		configPath
	});

	const fsTarget = resourceFactory.createAdapter({
		fsBasePath: targetPath,
		virBasePath: "/"
	});

	// create resources from the output files
	return Promise.all([
		fsTarget.byPath(`/test-resources/${namespace}/designtime/api.json`)
		// fsTarget.byPath(`/libraries/${options.libraryName}.js`)
		// ]).then((res) => res.filter($=>$));
	]);
};

module.exports._generateJsdocConfig = generateJsdocConfig;
module.exports._writeJsdocConfig = writeJsdocConfig;
module.exports._buildJsdoc = buildJsdoc;
