/*!
 * ${copyright}
 */

/**
 * Covers:
 * - ArrowFunction
 * - ChainExpression
 * - ClassDeclaration
 */
(sap?.ui).define(["Bar"], (Bar) => {
	return class Foo extends Bar {
		make() {
			sap.ui.require("conditional/module1");
		}
	};
});
