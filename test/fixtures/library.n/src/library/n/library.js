/*!
 * ${copyright}
 */

sap.ui.define([
	'mylib/Core',
	'mylib/library',
	'mob/library'
], function(
	Core,
	Library,
	mobLibrary
) {
	"use strict";

	// comment
	Core.doIt({
		prop1 : "val1"
	});

	return Core(Library(mobLibrary));
});
