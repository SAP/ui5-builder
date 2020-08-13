/*!
 * ${copyright}
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
