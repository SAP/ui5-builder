import test from "ava";
import {createRequire} from "node:module";

// Using CommonsJS require as importing json files causes an ExperimentalWarning
const require = createRequire(import.meta.url);

// package.json should be exported to allow reading version (e.g. from @ui5/cli)
test("export of package.json", (t) => {
	t.truthy(require("@ui5/builder/package.json").version);
});

// Public API contract (exported modules)
[
	"processors/bundlers/flexChangesBundler",
	"processors/bundlers/manifestBundler",
	"processors/bundlers/moduleBundler",
	"processors/jsdoc/apiIndexGenerator",
	"processors/jsdoc/jsdocGenerator",
	"processors/jsdoc/sdkTransformer",
	"processors/bootstrapHtmlTransformer",
	"processors/minifier",
	"processors/libraryLessGenerator",
	"processors/manifestCreator",
	"processors/nonAsciiEscaper",
	"processors/stringReplacer",
	"processors/themeBuilder",
	"processors/versionInfoGenerator",
	"tasks/bundlers/generateComponentPreload",
	"tasks/bundlers/generateFlexChangesBundle",
	"tasks/bundlers/generateLibraryPreload",
	"tasks/bundlers/generateManifestBundle",
	"tasks/bundlers/generateStandaloneAppBundle",
	"tasks/bundlers/generateThemeDesignerResources",
	"tasks/bundlers/generateBundle",
	"tasks/generateCachebusterInfo",
	"tasks/buildThemes",
	"tasks/minify",
	"tasks/jsdoc/executeJsdocSdkTransformation",
	"tasks/jsdoc/generateApiIndex",
	"tasks/jsdoc/generateJsdoc",
	"tasks/generateVersionInfo",
	"tasks/escapeNonAsciiCharacters",
	"tasks/replaceCopyright",
	"tasks/replaceVersion",
	"tasks/replaceBuildtime",
	"tasks/transformBootstrapHtml",
	"tasks/taskRepository",
].forEach((v) => {
	let exportedSpecifier, mappedModule;
	if (typeof v === "string") {
		exportedSpecifier = v;
	} else {
		exportedSpecifier = v.exportedSpecifier;
		mappedModule = v.mappedModule;
	}
	if (!mappedModule) {
		mappedModule = `../../lib/${exportedSpecifier}.js`;
	}
	const spec = `@ui5/builder/${exportedSpecifier}`;
	test(`${spec}`, async (t) => {
		const actual = await import(spec);
		const expected = await import(mappedModule);
		t.is(actual, expected, "Correct module exported");
	});
});

test("no export of processors/jsdoc/lib/ui5/plugin", async (t) => {
	await t.throwsAsync(import("@ui5/builder/processors/jsdoc/lib/ui5/plugin"), {
		code: "ERR_PACKAGE_PATH_NOT_EXPORTED"
	});
	await t.throwsAsync(import("@ui5/builder/processors/jsdoc/lib/ui5/plugin.js"), {
		code: "ERR_PACKAGE_PATH_NOT_EXPORTED"
	});
});

test("no export of tasks/bundlers/utils/createModuleNameMapping", async (t) => {
	await t.throwsAsync(import("@ui5/builder/tasks/bundlers/utils/createModuleNameMapping"), {
		code: "ERR_PACKAGE_PATH_NOT_EXPORTED"
	});
	await t.throwsAsync(import("@ui5/builder/tasks/bundlers/utils/createModuleNameMapping.js"), {
		code: "ERR_PACKAGE_PATH_NOT_EXPORTED"
	});
});
