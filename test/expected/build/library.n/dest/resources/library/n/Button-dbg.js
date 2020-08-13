/*!
 * UI development toolkit for HTML5 (OpenUI5)
 * (c) Copyright 2009-xxx SAP SE or an SAP affiliate company.
 * Licensed under the Apache License, Version 2.0 - see LICENSE.txt.
 */

// Provides control library.N.Button.
sap.ui.define([
	'mylib/MyFirstClass'
], function(
	MyFirstClass
) {
	"use strict";

	return MyFirstClass.doIt("library.n.Button", {
		prop: {
			value: function() {
				// requireSync Dependency
				sap.ui.requireSync("library/n/changeHandler/SplitButton");
			}
		},
		helper: function(sParam) {
			var sDynamicDependency = "mylib/dyn/" + sParam;
			// dynamicDependency
			sap.ui.require(["mylib/MyClass", sDynamicDependency], function(MyClass, dynDep) {
				new MyClass(dynDep);
			});
		}
	});
});
