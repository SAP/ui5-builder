/*!
 * ${copyright}
 */

sap.ui.define([
	"sap/ui/core/util/reflection/JsControlTreeModifier"
], function (
	JsControlTreeModifier
) {
	"use strict";

	var ButtonCH = {};

	SplitButton.applyChange = function(oChange, oControl, mPropertyBag) {
		if (mPropertyBag.modifier.targets !== "jsControlTree") {
			throw new Error("SplitButton change can't be applied on XML tree");
		}
		return true;
	};

	SplitButton.revertChange = function(oChange, oControl, mPropertyBag) {
		oChange.resetRevertData();
		return true;
	};

	return ButtonCH;
});
