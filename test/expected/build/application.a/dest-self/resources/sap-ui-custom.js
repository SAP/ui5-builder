//@ui5-bundle sap-ui-custom.js
sap.ui.require.preload({
	"application/a/test-dbg.js":function(){sap.ui.define([
    "library/d/some"
], function(someObject) {
	function test(paramA) {
		var variableA = paramA;
		console.log(variableA);
	}
	test();
});
},
	"application/a/test.js":function(){sap.ui.define(["library/d/some"],function(n){function o(n){var o=n;console.log(o)}o()});
//# sourceMappingURL=test.js.map
},
	"library/d/some.js":function(){/*!
 * ${copyright}
 */
(function() {
	var someNonUglifiedVariable = "World";
	console.log('Hello ' + someNonUglifiedVariable);
})();
}
});
