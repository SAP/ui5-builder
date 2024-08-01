import eslintCommonConfig from "./eslint.common.config.mjs";

export default [
	...eslintCommonConfig, // Load common ESLint config
	{ // Override with project-specific ESLint config rules (always below common!)
		ignores: [
			"lib/processors/jsdoc/lib",
			"**/coverage/",
			"test/tmp/",
			"test/expected/",
			"test/fixtures/",
			"**/docs/",
			"**/jsdocs/",
		],
	}
];
