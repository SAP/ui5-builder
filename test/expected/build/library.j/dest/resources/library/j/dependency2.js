/*!
 * ${copyright}
 */
sap.ui.define([], function () {
	sap.ui.getCore().initLibrary({
		name: "testlib",
		version: "${version}",
		dependencies: ["sap.ui.core"],
		designtime: "testlib/designtime/library.designtime",
		types: ["testlib.AnotherValidEnum"],
	});

	/**
	 * AnotherValidEnum
	 *
	 * @enum {string}
	 * @public
	 * @ui5-metamodel This enumeration also will be described in the UI5 (legacy) designtime metamodel
	 */
	testlib.AnotherValidEnum = {
		/**
		 * Fizz
		 * @public
		 */
		Fizz: "Fizz",
		/**
		 * Bar
		 * @public
		 */
		Buzz: "Buzz",
	};

	return testlib;
});
