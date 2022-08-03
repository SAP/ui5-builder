/*!
 * ${copyright}
 */
sap.ui.define([
	"sap/ui/core/Control", 
	"./dependency",
	"./dependency2",
	"./dependency-es6-1",
	"./dependency-es6-2",
	"./dependency-es6-3"
], function (Control, coreLib, library, es6_1, es6_2, es6_3) {
	"use strict";

	const { AnotherValidEnum: Zzz } = library;
	const { AnotherValidEnum } = library;
	const { Buzz } = AnotherValidEnum;
	const { TitleLevel } = sap.ui.core;

	/**
	 * @class
	 * My super documentation of this class
	 *
	 * @extends sap.ui.core.Control
	 *
	 * @author SAP SE
	 * @version ${version}
	 *
	 * @public
	 * @alias testlib.ValidPropertyDefaultValue
	 * @ui5-metamodel text
	 */
	var ValidPropertyDefaultValue = Control.extend(
		"testlib.ValidPropertyDefaultValue",
		{
			metadata: {
				properties: {
					/**
					 * validPropertyDefaultValueEnumViaDestructuringInArrowFn
					 */
					validPropertyDefaultValueEnumViaDestructuringInArrowFn:
						{
							type: "testlib.MyValidEnum",
							group: "Misc",
							defaultValue: coreLib.MyValidEnum.Foo,
						},

					/**
					 * validPropertyDefaultValueEnumViaDestructuringWithRename
					 */
					validPropertyDefaultValueEnumViaDestructuringWithRename:
						{
							type: "testlib.AnotherValidEnum",
							group: "Misc",
							defaultValue: Zzz.Fizz,
						},

					/**
					 * validPropertyDefaultValueEnumViaHierarchicalDestructuring
					 */
					validPropertyDefaultValueEnumViaHierarchicalDestructuring:
						{
							type: "testlib.AnotherValidEnum",
							group: "Misc",
							defaultValue: Buzz,
						},

					/**
					 * validPropertyDefaultValueEnumViaDestructuringGlobal
					 */
					validPropertyDefaultValueEnumViaDestructuringGlobal: {
						type: "sap.ui.core",
						group: "Misc",
						defaultValue: TitleLevel,
					},
				},
			},
			renderer: function () {},
		}
	);

	return ValidPropertyDefaultValue;
}, /* bExport= */ true);
