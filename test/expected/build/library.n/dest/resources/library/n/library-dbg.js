/*!
 * UI development toolkit for HTML5 (OpenUI5)
 * (c) Copyright 2009-xxx SAP SE or an SAP affiliate company.
 * Licensed under the Apache License, Version 2.0 - see LICENSE.txt.
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
