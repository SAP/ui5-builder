/*!
 * ${copyright}
 */

/**
 * Covers:
 * - LogicalExpression
 * - ArrowFunction
 * - ChainExpression
 * - ClassDeclaration
 */
window.someRandomModule ||
	(sap?.ui).define(["Bar"], (Bar) => {
		return class Foo extends Bar {
			make() {
				sap.ui.require("conditional/module1");
			}
		};
	});
