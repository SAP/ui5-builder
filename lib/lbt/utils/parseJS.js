"use strict";

const espree = require("espree");
const {Syntax} = espree;

const defaultOptions = {
	comment: false,
	ecmaVersion: 2020,
	range: false,
	sourceType: "script",
};

const allowedOptions = Object.keys(defaultOptions);

function parseJS(code, options = {}) {
	const firstUnsupportedOption =
		Object.keys(options).find((name) => !allowedOptions.includes(name));
	if (firstUnsupportedOption != null) {
		throw new TypeError(`Option ${firstUnsupportedOption} is not one of ${allowedOptions})`);
	}

	return espree.parse(code, Object.assign({}, defaultOptions, options));
}

module.exports = {
	parseJS,
	Syntax
};
