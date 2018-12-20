const {test} = require("ava");
const esprima = require("esprima");
const XMLCompositeAnalyzer = require("../../../../lib/lbt/analyzer/XMLCompositeAnalyzer");

test("analyze", async (t) => {
	const code = "sap.ui.define([\n" +
		"\t'jquery.sap.global', 'sap/ui/core/XMLComposite'],\n" +
		"\tfunction(jQuery, XMLComposite, XML) {\n" +
		"\t\"use strict\";\n" +
		"\tvar ButtonList = XMLComposite.extend(\"composites.ButtonList\", {\n" +
		"\t\tmetadata: {\n" +
		"\t\t\taggregations: {\n" +
		"\t\t\t\titems: {\n" +
		"\t\t\t\t\ttype: \"sap.ui.core.Item\",\n" +
		"\t\t\t\t\tmultiple: true\n" +
		"\t\t\t\t}\n" +
		"\t\t\t},\n" +
		"\t\t\tevents: {\n" +
		"\t\t\t\tpress: {\n" +
		"\t\t\t\t\tparameters: {\n" +
		"\t\t\t\t\t\tindex: {\n" +
		"\t\t\t\t\t\t\ttype: \"integer\"\n" +
		"\t\t\t\t\t\t},\n" +
		"\t\t\t\t\t\tkey: {\n" +
		"\t\t\t\t\t\t\ttype: \"string\"\n" +
		"\t\t\t\t\t\t}\n" +
		"\t\t\t\t\t}\n" +
		"\t\t\t\t}\n" +
		"\t\t\t}\n" +
		"\t\t}\n" +
		"\t});\n" +
		"\n" +
		"\treturn ButtonList;\n" +
		"});";

	const ast = esprima.parse(code);

	const name = "composites.ButtonList";
	const subject = new XMLCompositeAnalyzer({});
	const dependencies = [];
	const mockInfo = {
		addDependency(name) {
			dependencies.push(name);
		}
	};
	const oResult = await subject.analyze(ast, name, mockInfo);
	t.falsy(oResult);
	t.deepEqual(dependencies, ["composites/ButtonList.control.xml"]);
});
