/*!
 * ${copyright}
 */

sap.ui.define([
	"mylib/MyRename",
	"../changeHandler/SplitButton"
], function (MyRename, SplitButton) {
	"use strict";

	return {
		"prop1": "default",
		"prop2": SplitButton,
		"prop3": MyRename.doIt({
			prop1: "val1",
			prop2: "val2"
		}),
		"prop4": "val3"
	};
});