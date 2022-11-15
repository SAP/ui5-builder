/*!
 * ${copyright}
 */
sap.ui.define(
	[
		"sap/ui/core/Control",
		"./library",
		"./core/library",
		"sap/external/thirdparty/library",
		"sap/external2/thirdparty/library",
	],
	(
		Control,
		{ MyValidEnum, ThisIsEnumToo: RenamedEnum },
		coreLibrary,
		[arrPattern, {arrWith: {deep: arrPatternDeepDestruct}}],
		{ objPattern: {deeply: {destructured: objPatternDeepDestruct}, objPattern1Lvl}, ...libraryExt }
	) => {
		const { AnotherValidEnum } = coreLibrary;
		const { Buzz } = AnotherValidEnum;
		const { AnotherValidEnum: {Buzz: BuzzRenamed} } = coreLibrary;
		const { AnotherValidEnum: AnotherRenamedEnum } = coreLibrary;
		const { H1 } = sap.ui.core.TitleLevel;
		const { Value2: RenamedValue2 } = RenamedEnum;
		const [ arrPatternVarDef, {nested: {arrPatternVarDef: arrPatternVarDefNestedAndRenamed}} ] = libraryExt;

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
							defaultValue: AnotherValidEnum.Buzz
						},

						/**
						 * validPropertyDefaultValueEnumChainedDestructuring
						 */
						 validPropertyDefaultValueEnumChainedDestructuring: {
							type: "library.j.core.AnotherValidEnum",
							group: "Misc",
							defaultValue: Buzz
						},

						/**
						 * validPropertyDefaultValueEnumNestedDestructuring
						 */
						 validPropertyDefaultValueEnumChainedDestructuring: {
							type: "library.j.core.AnotherValidEnum",
							group: "Misc",
							defaultValue: BuzzRenamed
						},

						/**
						 * validPropertyDefaultValueEnumDestructuringWithRename
						 */
						validPropertyDefaultValueEnumDestructuringWithRename: {
							type: "library.j.core.AnotherValidEnum",
							group: "Misc",
							defaultValue: AnotherRenamedEnum.Fizz
						},

						/**
						 * validPropertyDefaultValueEnumDestructuringWithRenameInArguments
						 */
						validPropertyDefaultValueEnumDestructuringWithRenameInArguments:
							{
								type: "library.j.ThisIsEnumToo",
								group: "Misc",
								defaultValue: RenamedEnum.Value1
							},

						/**
						 * validPropertyDefaultValueEnumDestructuringWithRenameInArgumentsAndLocalVar
						 */
						validPropertyDefaultValueEnumDestructuringWithRenameInArgumentsAndLocalVar:
							{
								type: "library.j.ThisIsEnumToo",
								group: "Misc",
								defaultValue: RenamedValue2
							},

						/**
						 * validPropertyDefaultValueEnumViaDestructuringInArrowFn
						 */
						validPropertyDefaultValueEnumViaDestructuringInArrowFn:
							{
								type: "library.j.MyValidEnum",
								group: "Misc",
								defaultValue: MyValidEnum.Foo
							},

						/**
						 * validPropertyDefaultValueEnumViaDestructuringGlobal
						 */
						 validPropertyDefaultValueEnumViaDestructuringGlobal: {
							type: "sap.ui.core.TitleLevel",
							group: "Misc",
							defaultValue: H1
						},

						/**
						 * validPropertyDefaultValueArrPattern
						 */
						 validPropertyDefaultValueArrPattern: {
							type: "sap.external.thirdparty.library",
							group: "Misc",
							defaultValue: arrPattern
						},

						/**
						 * validPropertyDefaultValueArrPatternDeepDestruct
						 */
						 validPropertyDefaultValueArrPatternDeepDestruct: {
							type: "sap.external.thirdparty.library.arrWith.deep",
							group: "Misc",
							defaultValue: arrPatternDeepDestruct
						},

						/**
						 * validPropertyDefaultValueArrPatternDeepDestruct
						 */
						 validPropertyDefaultValueObjPatternDeepDestruct: {
							type: "sap.external2.thirdparty.library.objPattern.deeply",
							group: "Misc",
							defaultValue: objPatternDeepDestruct
						},

						/**
						 * validPropertyDefaultValueObjPatternNested
						 */
						 validPropertyDefaultValueObjPatternNested: {
							type: "sap.external2.thirdparty.library.objPattern",
							group: "Misc",
							defaultValue: objPattern1Lvl
						},

						/**
						 * validPropertyDefaultValueArrPatternVarDef
						 */
						 validPropertyDefaultValueArrPatternVarDef: {
							type: "sap.external2.thirdparty.library",
							group: "Misc",
							defaultValue: arrPatternVarDef
						},

						/**
						 * validPropertyDefaultValueArrPatternVarDef
						 */
						 validPropertyDefaultValueArrPatternVarDefNestedAndRenamed: {
							type: "sap.external2.thirdparty.library.nested",
							group: "Misc",
							defaultValue: arrPatternVarDefNestedAndRenamed
						}
					},
				},
				renderer: function () {},
			}
		);

		return ValidPropertyDefaultValue;
	},
	/* bExport= */ true
);
