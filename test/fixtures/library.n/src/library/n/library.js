/*!
 * ${copyright}
 */

sap.ui.define([
	'mylib/MyClass',
	'mylib/library',
	'mob/library'
], function(
	MyClass,
	Library,
	mobLibrary
) {
	"use strict";
	return MyClass(Library(mobLibrary));
});
