import eslintCommonConfig from "./eslint.common.config.mjs";


export default [{
	ignores: [
		"lib/processors/jsdoc/lib",
		"**/coverage/",
		"test/tmp/",
		"test/expected/",
		"test/fixtures/",
		"**/docs/",
		"**/jsdocs/",
	],
}, ...eslintCommonConfig];
