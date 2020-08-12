/*!
 * ${copyright}
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
