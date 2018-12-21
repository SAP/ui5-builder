const {test} = require("ava");
const esprima = require("esprima");
const XMLCompositeAnalyzer = require("../../../../lib/lbt/analyzer/XMLCompositeAnalyzer");

test("analyze", async (t) => {
	const code = `sap.ui.define([
		'jquery.sap.global', 'sap/ui/core/XMLComposite'],
		function(jQuery, XMLComposite, XML) {
		"use strict";
		var ButtonList = XMLComposite.extend("composites.ButtonList", {
			metadata: {
				aggregations: {
					items: {
						type: "sap.ui.core.Item",
						multiple: true
					}
				},
				events: {
					press: {
						parameters: {
							index: {
								type: "integer"
							},
							key: {
								type: "string"
							}
						}
					}
				}
			}
		});
		return ButtonList;
	});`;

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
