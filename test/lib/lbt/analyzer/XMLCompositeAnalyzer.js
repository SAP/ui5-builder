const {test} = require("ava");
const esprima = require("esprima");
const XMLCompositeAnalyzer = require("../../../../lib/lbt/analyzer/XMLCompositeAnalyzer");
const ModuleInfo = require("../../../../lib/lbt/resources/ModuleInfo");

test("Analysis of XMLComposite code", async (t) => {
	const code = `sap.ui.define([
		'jquery.sap.global', 'sap/ui/core/XMLComposite'],
		function(jQuery, XMLComposite) {
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

	const analyzer = new XMLCompositeAnalyzer({});
	const name = "composites.ButtonList";
	const moduleInfo = new ModuleInfo();
	await analyzer.analyze(ast, name, moduleInfo);
	t.deepEqual(moduleInfo.dependencies, ["composites/ButtonList.control.xml"],
		"Dependency should be created from component name");
});
