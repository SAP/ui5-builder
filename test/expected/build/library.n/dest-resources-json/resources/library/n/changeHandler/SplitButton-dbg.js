/*!
 * UI development toolkit for HTML5 (OpenUI5)
 * (c) Copyright 2009-xxx SAP SE or an SAP affiliate company.
 * Licensed under the Apache License, Version 2.0 - see LICENSE.txt.
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
