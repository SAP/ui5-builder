/*!
 * ${copyright}
 */

/**
 * Covers:
 * - ArrowFunctionExpression
 */
sap.ui.define(["/.a"], (a) =>
	a.extend("aaa", {
		metadata: {
			properties: {
				MyProp: {
					type: "Boolean",
					group: "Misc",
					defaultValue: true,
				},
			},
		},
	})
);
