/*!
 * ${copyright}
 */

// comment
sap.ui.define([],
	function () {
		"use strict";

		return {
			prop1: {
				val1: "string1",
				icons: {
					svg: "library/n/designtime/Button.icon.svg"
				}
			},
			prop2: {
				val1: {
					myaction: "string",
					myboolean : true,
					myboolean2 : true
				},
				val2: {
					myaction: "string"
				},
				val3: {
					myaction: "foo"
				},
				val4: {
					myaction: "bar",
					doIt: function (foo) {
						return foo[0];
					}
				},
				val5: {
					myaction: "foo"
				}
			},
			prop3: {
				first: "mystring"
			}
		};
	});