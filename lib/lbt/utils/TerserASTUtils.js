"use strict";

const terser = require("terser");

function isMethodCall(node, methodPath) {
	if ( !(node instanceof terser.AST_Call) ) {
		return false;
	}

	// BYFIELD ( BYFIELD ( BYFIELD ( a, b), c), d)
	return isNamedObject(node.expression, methodPath, methodPath.length);
}

function isNamedObject(node, objectPath, length) {
	// console.log("checking for named object ", node, objectPath, length);
	while ( length > 1 &&
			node instanceof terser.AST_Dot &&
			isIdentifier(node.property, objectPath[length-1]) ) {
		node = node.expression;
		length--;
	}
	return length === 1 && isIdentifier(node.name, objectPath[0]);
}

function isIdentifier(propertyValue, name) {
	if ( typeof name == "string" ) {
		return name === propertyValue;
	}
	for (let i = 0; i < name.length; i++) {
		if ( name[i] === propertyValue || name[i] === "*" ) {
			return true;
		}
	}
	return false;
}

module.exports = {
	isMethodCall
};
