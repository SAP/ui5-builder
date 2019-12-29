/*!
 * UI development toolkit for HTML5 (OpenUI5)
 * (c) Copyright 2009-xxx SAP SE or an SAP affiliate company.
 * Licensed under the Apache License, Version 2.0 - see LICENSE.txt.
 */

// Provides control library.N.Button.
sap.ui.define([
	'./library',
	'sap/ui/core/Control'
], function(
	library,
	Control
) {
	"use strict";

	return Control.extend("library.n.Button", {
		metadata : {
			library : "library.n",
			properties : {
				text: {type: "string", group: "Misc", defaultValue: "" }
			},
			aggregations: {
				icon: {type: "sap.ui.core.Control", cardinality: "0..1" }
			},
			events: {
				press: {}
			}
		},
		designtime: "library/n/designtime/Button.designtime",
		renderer: {
			apiVersion: 2,
			render: function(oRm, oButton) {
				oRm.openStart("button", oButton);
				oRm.class("libNBtnBase");
				oRm.openEnd();
				if ( oButton.getIcon() ) {
					oRm.renderControl(oButton.getIcon());
				}
				oRm.openStart("span", oButton.getId() + "-content");
				oRm.class("libNBtnContent");
				oRm.openEnd();
				oRm.text(sText);
				oRm.close("span");
				oRm.close("button");
			}
		},
		helper: function(sCalendarType) {
			var sCalendar = "sap/ui/core/date/" + sCalendarType;
			sap.ui.require(["sap/ui/core/format/DateFormat", sCalendar], function(DateFormat, Calendar) {
				DateFormat.getInstance();
				new Calendar();
			});
		}
	});

});