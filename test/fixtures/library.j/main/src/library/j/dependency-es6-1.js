/*!
 * ${copyright}
 */

/**
 * Covers:
 * - ArrowFunction
 * - ChainExpression
 * - ClassDeclaration
 */
(sap?.ui).define([`Bar`], (Bar) => {
	/**
	 * @class
	 * My super documentation of this class
	 *
	 * @extends library.j.Bar
	 *
	 * @author SAP SE
	 * @version ${version}
	 *
	 * @public
	 * @alias library.j.Foo
	 * @ui5-metamodel text
	 */
	class Foo extends Bar {
		make() {
			sap.ui.require("conditional/module1");
		}
	}

	return Foo;
});
