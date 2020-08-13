/*!
 * UI development toolkit for HTML5 (OpenUI5)
 * (c) Copyright 2009-xxx SAP SE or an SAP affiliate company.
 * Licensed under the Apache License, Version 2.0 - see LICENSE.txt.
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