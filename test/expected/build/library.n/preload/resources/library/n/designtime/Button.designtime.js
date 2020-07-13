/*!
 * ${copyright}
 */

// Provides the Design Time Metadata for the library.n.Button control
sap.ui.define([],
	function () {
		"use strict";

		return {
			palette: {
				group: "ACTION",
				icons: {
					svg: "library/n/designtime/Button.icon.svg"
				}
			},
			actions: {
				combine: {
					changeType: "combineButtons",
					changeOnRelevantContainer : true,
					isEnabled : true
				},
				remove: {
					changeType: "hideControl"
				},
				split: {
					changeType: "split"
				},
				rename: {
					changeType: "rename",
					domRef: function (oControl) {
						return oControl.$().find(".libNBtnContent")[0];
					}
				},
				reveal: {
					changeType: "unhideControl"
				}
			},
			templates: {
				create: "library/n/designtime/Button.create.fragment.xml"
			}
		};
	});