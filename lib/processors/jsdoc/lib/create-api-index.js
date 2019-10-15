#!/usr/bin/env node

/**
 * Standalone script which is used to create the index
 */
const createIndexFiles = require("./createIndexFiles");

const versionInfoFile = path.normalize(process.argv[2]);
const unpackedTestresourcesRoot = path.normalize(process.argv[3]);
const targetFile = path.normalize(process.argv[4]);
const targetFileDeprecated = path.normalize(process.argv[5]);
const targetFileExperimental = path.normalize(process.argv[6]);
const targetFileSince = path.normalize(process.argv[7]);

createIndexFiles(
	versionInfoFile,
	unpackedTestresourcesRoot,
	targetFile,
	targetFileDeprecated,
	targetFileExperimental,
	targetFileSince
).catch(oError => {
	log.error(oError);
	process.exit(1);
});
