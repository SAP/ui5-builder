"use strict";

const espree = require("espree");
const {Syntax} = espree;

function parseJS(code, userOptions = {}) {

	// allowed options and their defaults
	const options = {
		comment: false,
		ecmaVersion: 2020,
		range: false,
		sourceType: "script",
	};

	// validate and assign options
	for (const [name,value] of Object.entries(userOptions)) {
		if (!options.hasOwnProperty(name)) {
			throw new TypeError(`Allowed parser options are ${Object.keys(options)}, but not '${name}'`);
		}
		options[name] = value;
	}

	return espree.parse(code, options);
}

module.exports = {
	parseJS,
	Syntax
};
