/*!
 * ${copyright}
 */

/*global my,sap */
(function(deps, callback) {

	"use strict";

	function doIt(array, callback) {
		callback();
	}

	var aArray = [];

	doIt(aArray, function() {
		doIt([
			"foo"
		], function() {
			doIt([
				"bar"
			], function() {
				// nested sap.ui.require
				sap.ui.require(deps, callback);
			});
		});
	});

}([
	"my/dependency"
], function(myDep) {
	"use strict";
	console.log("done")
}));