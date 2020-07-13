/*!
 * ${copyright}
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
		version: "${version}",
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
