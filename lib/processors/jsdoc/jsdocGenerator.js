import {spawn} from "node:child_process";
import fs from "graceful-fs";
import path from "node:path";
import {promisify} from "node:util";
const writeFile = promisify(fs.writeFile);
import {createAdapter} from "@ui5/fs/resourceFactory";
import {fileURLToPath} from "node:url";

/**
 * @public
 * @module @ui5/builder/processors/jsdoc/jsdocGenerator
 */

/**
 * JSDoc generator
 *
 * @public
 * @function default
 * @static
 *
 * @param {object} parameters Parameters
 * @param {string} parameters.sourcePath Path of the source files to be processed
 * @param {string} parameters.targetPath Path to write any output files
 * @param {string} parameters.tmpPath Path to write temporary and debug files
 * @param {object} parameters.options Options
 * @param {string} parameters.options.projectName Project name
 * @param {string} parameters.options.namespace Namespace to build (e.g. <code>some/project/name</code>)
 * @param {string} parameters.options.version Project version
 * @param {Array} [parameters.options.variants=["apijson"]] JSDoc variants to be built
 * @returns {Promise<@ui5/fs/Resource[]>} Promise resolving with newly created resources
 */
export default async function jsdocGenerator(
	{sourcePath, targetPath, tmpPath, options: {projectName, namespace, version, variants}} = {}
) {
	if (!sourcePath || !targetPath || !tmpPath || !projectName || !namespace || !version) {
		throw new Error("[jsdocGenerator]: One or more mandatory parameters not provided");
	}

	if (!variants || variants.length === 0) {
		variants = ["apijson"];
	}

	const config = await jsdocGenerator._generateJsdocConfig({
		targetPath,
		tmpPath,
		namespace,
		projectName,
		version,
		variants
	});

	const configPath = await jsdocGenerator._writeJsdocConfig(tmpPath, config);

	await jsdocGenerator._buildJsdoc({
		sourcePath,
		configPath
	});

	const fsTarget = createAdapter({
		fsBasePath: targetPath,
		virBasePath: "/"
	});

	// create resources from the output files
	return Promise.all([
		fsTarget.byPath(`/test-resources/${namespace}/designtime/api.json`)
		// fsTarget.byPath(`/libraries/${options.projectName}.js`)
	]).then((res) => res.filter(($)=>$));
}


/**
 * Generate jsdoc-config.json content
 *
 * @private
 * @param {object} parameters Parameters
 * @param {string} parameters.targetPath Path to write any output files
 * @param {string} parameters.tmpPath Path to write temporary and debug files
 * @param {string} parameters.projectName Project name
 * @param {string} parameters.version Project version
 * @param {string} parameters.namespace Namespace to use (e.g. <code>some/project/name</code>)
 * @param {Array} parameters.variants JSDoc variants to be built
 * @returns {string} jsdoc-config.json content string
 */
async function generateJsdocConfig({targetPath, tmpPath, namespace, projectName, version, variants}) {
	// Backlash needs to be escaped as double-backslash
	// This is not only relevant for win32 paths but also for
	//	Unix directory names that contain a backslash in their name
	const backslashRegex = /\\/g;

	// Resolve path to this script to get the path to the JSDoc extensions folder
	const jsdocPath = path.normalize(import.meta.dirname);
	const pluginPath = path.join(jsdocPath, "lib", "ui5", "plugin.js").replace(backslashRegex, "\\\\");
	const templatePath = path.join(jsdocPath, "lib", "ui5", "template").replace(backslashRegex, "\\\\");
	const destinationPath = path.normalize(tmpPath).replace(backslashRegex, "\\\\");
	const jsapiFilePath = path.join(targetPath, "libraries", projectName + ".js").replace(backslashRegex, "\\\\");
	const apiJsonFolderPath = path.join(tmpPath, "dependency-apis").replace(backslashRegex, "\\\\");
	const apiJsonFilePath =
		path.join(targetPath, "test-resources", path.normalize(namespace), "designtime", "api.json")
			.replace(backslashRegex, "\\\\");

	// Note: While the projectName could also be used here, it is not ensured that it fits to
	// the library namespace.
	// As the "uilib" information is used to check for certain constraints it must be aligned with
	// the technical namespace that is used in the folder-structure, library.js and for the
	// sap.ui.base.Object based classes.
	const uilib = namespace.replace(/\//g, ".");

	const config = `{
		"plugins": ["${pluginPath}"],
		"opts": {
			"recurse": true,
			"lenient": true,
			"template": "${templatePath}",
			"ui5": {
				"saveSymbols": true
			},
			"destination": "${destinationPath}"
		},
		"templates": {
			"ui5": {
				"variants": ${JSON.stringify(variants)},
				"version": "${version}",
				"uilib": "${uilib}",
				"jsapiFile": "${jsapiFilePath}",
				"apiJsonFolder": "${apiJsonFolderPath}",
				"apiJsonFile": "${apiJsonFilePath}"
			}
		}
	}`;
	return config;
}

/**
 * Write jsdoc-config.json to file system
 *
 * @private
 * @param {string} targetDirPath Directory Path to write the jsdoc-config.json file to
 * @param {string} config jsdoc-config.json content
 * @returns {string} Full path to the written jsdoc-config.json file
 */
async function writeJsdocConfig(targetDirPath, config) {
	const configPath = path.join(targetDirPath, "jsdoc-config.json");
	await writeFile(configPath, config);
	return configPath;
}


/**
 * Execute JSDoc build by spawning JSDoc as an external process
 *
 * @private
 * @param {object} parameters Parameters
 * @param {string} parameters.sourcePath Project resources (input for JSDoc generation)
 * @param {string} parameters.configPath Full path to jsdoc-config.json file
 * @returns {Promise<undefined>}
 */
async function buildJsdoc({sourcePath, configPath}) {
	const args = [
		fileURLToPath(import.meta.resolve("jsdoc/jsdoc.js")),
		"-c",
		configPath,
		"--verbose",
		sourcePath
	];
	const exitCode = await new Promise((resolve /* , reject */) => {
		const child = spawn("node", args, {
			stdio: ["ignore", "ignore", "inherit"]
		});
		child.on("close", resolve);
	});

	if (exitCode !== 0) {
		throw new Error(`JSDoc reported an error, check the log for issues (exit code: ${exitCode})`);
	}
}

jsdocGenerator._generateJsdocConfig = generateJsdocConfig;
jsdocGenerator._writeJsdocConfig = writeJsdocConfig;
jsdocGenerator._buildJsdoc = buildJsdoc;
