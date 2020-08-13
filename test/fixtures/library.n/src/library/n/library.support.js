/*!
 * ${copyright}
 */
sap.ui.define([
	"mylib/support/library",
	"./rules/Button.support"
], function(
		SupportLib,
		ButtonSupport,
	) {
	"use strict";

	return {
		name: "library.n",
		niceName: "Library N",
		ruleset: [
			ButtonSupport
		]
	};

});