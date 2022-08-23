/*!
 * ${copyright}
 */

/**
 * Covers:
 * - ArrowFunctionExpression
 */
window.someRandomModule ||
	sap.ui.define(["/.a"], (a) =>
		a.extend("aaa", {
			metadata: {
				properties: {
					MyProp: {
						type: "boolean",
						group: "Misc",
						defaultValue: false,
					},
				},
			},
		})
	);
