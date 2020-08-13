/*!
 * UI development toolkit for HTML5 (OpenUI5)
 * (c) Copyright 2009-xxx SAP SE or an SAP affiliate company.
 * Licensed under the Apache License, Version 2.0 - see LICENSE.txt.
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
