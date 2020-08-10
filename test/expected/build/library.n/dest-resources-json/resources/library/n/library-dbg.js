/*!
 * UI development toolkit for HTML5 (OpenUI5)
 * (c) Copyright 2009-xxx SAP SE or an SAP affiliate company.
 * Licensed under the Apache License, Version 2.0 - see LICENSE.txt.
 */

sap.ui.define([
	'sap/ui/core/Core',
	'sap/ui/core/library',
	'sap/m/library'
], function(
	Core,
	coreLibrary,
	mobileLibrary
) {
	"use strict";

	// delegate further initialization of this library to the Core
	sap.ui.getCore().initLibrary({
		name : "library.n",
		version: "1.0.0",
		dependencies : ["sap.ui.core", "sap.m"],
		designtime: "library/n/designtime/library.designtime",
		types: [],
		interfaces: [],
		controls: [],
		elements: [],
		extensions: {
			flChangeHandlers: {
				"library.n.Button": "library/n/flexibility/Button"
			},
			"sap.ui.support": {
				publicRules:true,
				internalRules:false
			}
		}
	});

	return sap.m;
});
