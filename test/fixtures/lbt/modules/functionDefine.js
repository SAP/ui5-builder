/*!
 * ${copyright}
 */
/*global my */
(function() {
	"use strict";

	function defineMyFile() {
		sap.ui.define('def/MyFile', ['dep/myDep'],
			function(myDep) {
				return 47;
			});
	}

	// conditional
	if (!(window.sap && window.sap.ui && window.sap.ui.define)) {
		var fnHandler = function() {
			defineMyFile();
		};
		my.addEventListener("myevent", fnHandler);
	} else {
		defineMyFile();
	}
}());