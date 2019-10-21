#!/usr/bin/env node

/**
 * Standalone script which is used to create the index
 */
const transformer = require("./transformApiJson");

const log = (function() {
	/* eslint-disable no-console */
	return {
		info: function info(...msg) {
			console.log("[INFO]", ...msg);
		},
		error: function error(...msg) {
			console.error(...msg);
		}
	};
	/* eslint-enable no-console */
}());

const sInputFile = process.argv[2];
const sOutputFile = process.argv[3];
const sLibraryFile = process.argv[4];
const sAPIJSonDependencyDir = process.argv[5];

transformer(sInputFile, sOutputFile, sLibraryFile, sAPIJSonDependencyDir)
.catch(oError => {
	log.error(oError);
});
