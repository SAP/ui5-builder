/*!
 * ${copyright}
 */
sap.ui.define([
	"sap/ui/core/Control",
	"./library",
	"./core/library"
], (Control, { MyValidEnum, ThisIsEnumToo: RenamedEnum }, coreLibrary) => {
	const { AnotherValidEnum } = coreLibrary;
	const { Buzz } = AnotherValidEnum;
	const { AnotherValidEnum: AnotherRenamedEnum } = coreLibrary;
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
	 * @alias library.j.ValidPropertyDefaultValue
	 * @ui5-metamodel text
	 */
	var ValidPropertyDefaultValue = Control.extend(
		"library.j.ValidPropertyDefaultValue",
		{
			metadata: {
				properties: {
					/**
					 * validPropertyDefaultValueEnumSimpleDestructuring
					 */
					validPropertyDefaultValueEnumSimpleDestructuring: {
						type: "library.j.core.AnotherValidEnum",
						group: "Misc",
						defaultValue: AnotherValidEnum.Buzz,
					},

					/**
					 * validPropertyDefaultValueEnumChainedDestructuring
					 */
					validPropertyDefaultValueEnumChainedDestructuring: {
						type: "library.j.core.AnotherValidEnum",
						group: "Misc",
						defaultValue: Buzz,
					},

					/**
					 * validPropertyDefaultValueEnumDestructuringWithRename
					 */
					validPropertyDefaultValueEnumDestructuringWithRename: {
						type: "library.j.core.AnotherValidEnum",
						group: "Misc",
						defaultValue: AnotherRenamedEnum.Fizz,
					},

					/**
					 * validPropertyDefaultValueEnumDestructuringWithRenameInArguments
					 */
					validPropertyDefaultValueEnumDestructuringWithRenameInArguments:
						{
							type: "library.j.ThisIsEnumToo",
							group: "Misc",
							defaultValue: RenamedEnum.Value1,
						},

					/**
					 * validPropertyDefaultValueEnumDestructuringWithRenameInArgumentsAndLocalVar
					 */
					validPropertyDefaultValueEnumDestructuringWithRenameInArgumentsAndLocalVar:
						{
							type: "library.j.ThisIsEnumToo",
							group: "Misc",
							defaultValue: RenamedValue2,
						},

					/**
					 * validPropertyDefaultValueEnumViaDestructuringInArrowFn
					 */
					validPropertyDefaultValueEnumViaDestructuringInArrowFn: {
						type: "library.j.MyValidEnum",
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
