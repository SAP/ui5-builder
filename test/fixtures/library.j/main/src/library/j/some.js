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
], (Control, { MyValidEnum, ThisIsEnumToo: RenamedEnum }, library, es6_1, es6_2, es6_3) => {

	const { AnotherValidEnum } = library;
	const { Buzz } = AnotherValidEnum;
	const { AnotherValidEnum: Zzz } = library;
	const { H1 } = sap.ui.core.TitleLevel;
	const { Value2: RenamedValue2 } = RenamedEnum;

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
					 * validPropertyDefaultValueEnumSimpleDestructuring
					 */
					validPropertyDefaultValueEnumSimpleDestructuring: {
						type: "testlib.AnotherValidEnum",
						group: "Misc",
						defaultValue: AnotherValidEnum.Buzz,
					},

					/**
					 * validPropertyDefaultValueEnumChainedDestructuring
					 */
					validPropertyDefaultValueEnumChainedDestructuring: {
						type: "testlib.AnotherValidEnum",
						group: "Misc",
						defaultValue: Buzz,
					},

					/**
					 * validPropertyDefaultValueEnumDestructuringWithRename
					 */
					validPropertyDefaultValueEnumDestructuringWithRename: {
						type: "testlib.AnotherValidEnum",
						group: "Misc",
						defaultValue: Zzz.Fizz,
					},

					/**
					 * validPropertyDefaultValueEnumDestructuringWithRenameInArguments
					 */
					validPropertyDefaultValueEnumDestructuringWithRenameInArguments: {
						type: "testlib.ThisIsEnumToo",
						group: "Misc",
						defaultValue: RenamedEnum.Value1,
					},

					/**
					 * validPropertyDefaultValueEnumDestructuringWithRenameInArgumentsAndLocalVar
					 */
					validPropertyDefaultValueEnumDestructuringWithRenameInArgumentsAndLocalVar: {
						type: "testlib.ThisIsEnumToo",
						group: "Misc",
						defaultValue: RenamedValue2,
					},

					/**
					 * validPropertyDefaultValueEnumViaDestructuringInArrowFn
					 */
					validPropertyDefaultValueEnumViaDestructuringInArrowFn: {
						type: "testlib.MyValidEnum",
						group: "Misc",
						defaultValue: MyValidEnum.Foo,
					},

					/**
					 * validPropertyDefaultValueEnumViaDestructuringGlobal
					 */
					validPropertyDefaultValueEnumViaDestructuringGlobal: {
						type: "sap.ui.core.TitleLevel",
						group: "Misc",
						defaultValue: H1,
					},
				},
			},
			renderer: function () {},
		}
	);

	return ValidPropertyDefaultValue;
}, /* bExport= */ true);
