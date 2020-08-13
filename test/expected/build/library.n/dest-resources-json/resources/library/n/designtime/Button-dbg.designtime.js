/*!
 * UI development toolkit for HTML5 (OpenUI5)
 * (c) Copyright 2009-xxx SAP SE or an SAP affiliate company.
 * Licensed under the Apache License, Version 2.0 - see LICENSE.txt.
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