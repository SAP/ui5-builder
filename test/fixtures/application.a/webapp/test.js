sap.ui.define([
	"library/d/some"
], function(someObject) {
	function test(paramA) {
		const variableA = paramA;
		console.log(variableA);
	}
	test();
});
