/*!
 * ${copyright}
 */

sap.ui.define([
	"sap/ui/fl/changeHandler/BaseRename",
	"../changeHandler/SplitButton"
], function (BaseRename, SplitButton) {
	"use strict";

	return {
		"hideControl": "default",
		"split": SplitButton,
		"rename": BaseRename.createRenameChangeHandler({
			propertyName: "text",
			translationTextType: "XBUT"
		}),
		"unhideControl": "default"
	};
});