/*!
 * ${copyright}
 */

sap.ui.define([
	"mylib/util/myUtil"
], function (
	myUtil
) {
	"use strict";

	var SplitButton = {};

	SplitButton.doIt = function(param1) {
		return myUtil(param1);
	};

	return SplitButton;
});
