sap.ui.define([], function () {
	sap.ui.getCore().initLibrary({
		name: "testlib",
		version: "${version}",
		dependencies: ["sap.ui.core"],
		designtime: "testlib/designtime/library.designtime",
		types: ["testlib.MyValidEnum"],
	});

	/**
	 * MyValidEnum
	 *
	 * @enum {string}
	 * @public
	 * @ui5-metamodel This enumeration also will be described in the UI5 (legacy) designtime metamodel
	 */
	testlib.MyValidEnum = {
		/**
		 * Foo
		 * @public
		 */
		Foo: "Foo",
		/**
		 * Bar
		 * @public
		 */
		Bar: "Bar",
	};

	return testlib;
});
