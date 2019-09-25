const test = require("ava");
const LibraryFileAnalyzer = require("../../../../lib/lbt/resources/LibraryFileAnalyzer");

test("extract packaging info from .library file", (t) => {
	const libraryFile = `\
<?xml version="1.0" encoding="UTF-8" ?>
<library xmlns="http://www.sap.com/sap.ui.library.xsd" >
  <name>sap.ui.core</name>
  <copyright>(c) 2019 SAP SE</copyright>
  <version>1.99.0</version>
  <documentation>Some doc.</documentation>
  <appData>
    <packaging xmlns="http://www.sap.com/ui5/buildext/packaging" version="2.0" >
      <module-infos>
        <raw-module name="vendor/blanket.js" />
        <raw-module name="vendor/crossroads.js" depends="vendor/signals.js" ignoredGlobals=" foo, bar "/>
        <raw-module name="vendor/hasher.js" depends="vendor/signals.js" />
        <raw-module name="vendor/require.js" />
      </module-infos>
      <all-in-one>
        <exclude name="vendor/blanket.js" />
      </all-in-one>
    </packaging>
  </appData>
</library>
`;

	const expectedNames = ["vendor/blanket.js", "vendor/crossroads.js", "vendor/hasher.js", "vendor/require.js"];
	const expectedDependencies = [
		[],
		["vendor/signals.js"],
		["vendor/signals.js"],
		[]
	];
	const expectedIG = [undefined, ["foo", "bar"], undefined, undefined];


	const actual = LibraryFileAnalyzer.getDependencyInfos(libraryFile);

	t.deepEqual(Object.keys(actual), expectedNames, "library a has been added to resources array twice");
	expectedNames.forEach((name, idx) => {
		t.is(actual[name].rawModule, true, "info should have rawModule marker");
		t.is(actual[name].name, name, "info should have expected module id");
		t.deepEqual(actual[name].dependencies, expectedDependencies[idx], "info should have the expected dependencies");
		t.deepEqual(actual[name].ignoredGlobals, expectedIG[idx], "ignoredGlobals should have the expected value");
	});
});
