const escapeUnicode = require("escape-unicode");

/**
 * @see https://ascii.cl/
 * @type {number}
 */
const NUMBER_OF_ASCII_CHARACTERS = 127;

// use memoization for escapeUnicode function for performance
const memoizeEscapeUnicodeMap = {};
const memoizeEscapeUnicode = function(sChar) {
	if (memoizeEscapeUnicodeMap[sChar]) {
		return memoizeEscapeUnicodeMap[sChar];
	}
	memoizeEscapeUnicodeMap[sChar] = escapeUnicode(sChar);
	return memoizeEscapeUnicodeMap[sChar];
};

/**
 * Escapes non ASCII characters with unicode characters.
 *
 * @see https://ascii.cl/
 * @see https://tools.ietf.org/html/rfc5137#section-6.1
 *
 *
 * @param {string} string input string with non ascii characters, e.g. L♥VE
 * @returns {{string: (string), modified: boolean}} output string with all non ascii characters being escaped by unicode sequence, e.g. L\u2665VE
 */
const escapeNonAscii = function(string) {
	let result = "";
	let modified = false;
	for (let i = 0; i < string.length; i++) {
		const char = string[i];
		// check for non ascii characters
		if (string.charCodeAt(i) > NUMBER_OF_ASCII_CHARACTERS) {
			result += memoizeEscapeUnicode(char);
			modified = true;
		} else {
			result += char;
		}
	}
	return {
		modified,
		string: result
	};
};

module.exports = function({resources}) {
	return Promise.all(resources.map((resource) => {
		return resource.getString().then((resourceString) => {
			const escaped = escapeNonAscii(resourceString);
			// only modify the resource's string if it was changed
			if (escaped.modified) {
				resource.setString(escaped.string);
			}
			return resource;
		});
	}));
};
