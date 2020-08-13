/*!
 * some fancy copyright
 */

sap.ui.define([
	"mylib/MyRename",
	"../changeHandler/SplitButton"
], function (MyRename, SplitButton) {
	"use strict";

	return {
		"prop2": SplitButton,
		"prop3": MyRename.doIt(),
	};
});