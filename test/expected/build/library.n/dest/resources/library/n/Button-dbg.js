/*!
 * UI development toolkit for HTML5 (OpenUI5)
 * (c) Copyright 2009-xxx SAP SE or an SAP affiliate company.
 * Licensed under the Apache License, Version 2.0 - see LICENSE.txt.
 */

// Provides control library.N.Button.
sap.ui.define([
	'sap/ui/core/Control'
], function(
	Control
) {
	"use strict";

	return Control.extend("library.n.Button", {
		renderer: {
			render: function(oRm, oButton) {
				// requireSync Dependency
				sap.ui.requireSync("library/n/changeHandler/SplitButton");
			}
		},
		helper: function(sCalendarType) {
			var sCalendar = "sap/ui/core/date/" + sCalendarType;
			// dynamicDependency
			sap.ui.require(["sap/ui/core/format/DateFormat", sCalendar], function(DateFormat, Calendar) {
				DateFormat.getInstance();
				new Calendar();
			});
		}
	});
});
