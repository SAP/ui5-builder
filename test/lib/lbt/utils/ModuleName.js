const {test} = require("ava");
const ModuleName = require("../../../../lib/lbt/utils/ModuleName");


test("test ModuleName fromUI5LegacyName", (t) => {
	t.is(ModuleName.fromUI5LegacyName(""), ".js");
	t.is(ModuleName.fromUI5LegacyName("a/b"), "a/b.js");
	t.is(ModuleName.fromUI5LegacyName("a.b"), "a/b.js");
	t.is(ModuleName.fromUI5LegacyName("jquery.sap.b"), "jquery.sap.b.js");
	t.is(ModuleName.fromUI5LegacyName("jquery-b"), "jquery-b.js");
	t.is(ModuleName.fromUI5LegacyName("jquery-b", ".mjs"), "jquery-b.mjs");
	const jQuerythirdParty = "sap.ui.thirdparty.jquery.jquery-b";
	const jQuerythirdPartyExpected = "sap/ui/thirdparty/jquery/jquery-b.mjs";
	t.is(ModuleName.fromUI5LegacyName(jQuerythirdParty, ".mjs"), jQuerythirdPartyExpected);
});

test("test ModuleName toUI5LegacyName", (t) => {
	t.is(ModuleName.toUI5LegacyName(".js"), "");
	t.is(ModuleName.toUI5LegacyName("a/b.js"), "a.b");
	t.is(ModuleName.toUI5LegacyName("a/b.js"), "a.b");
	t.is(ModuleName.toUI5LegacyName("jquery.sap.b.js"), "jquery.sap.b");
	t.is(ModuleName.toUI5LegacyName("jquery-b.js"), "jquery-b");
	const error = t.throws(() => {
		ModuleName.toUI5LegacyName("jquery-b.mjs");
	}, Error);

	t.is(error.message, "can't convert a non-JS resource name jquery-b.mjs to a UI5 module name");
	const jQuerythirdParty = "sap/ui/thirdparty/jquery/jquery-b.js";
	const jQuerythirdPartyExpected = "sap.ui.thirdparty.jquery.jquery-b";
	t.is(ModuleName.toUI5LegacyName(jQuerythirdParty), jQuerythirdPartyExpected);
});

test("test ModuleName fromRequireJSName", (t) => {
	t.is(ModuleName.fromRequireJSName("a"), "a.js");
});

test("test ModuleName toRequireJSName", (t) => {
	t.is(ModuleName.toRequireJSName("a.js"), "a");
	const error = t.throws(() => {
		ModuleName.toRequireJSName("a");
	}, Error);

	t.is(error.message, "can't convert a non-JS resource name a to a requireJS module name");
});

test("test ModuleName getDebugName", (t) => {
	t.is(ModuleName.getDebugName("a.controller.js"), "a-dbg.controller.js");
	t.is(ModuleName.getDebugName("a.css"), "a-dbg.css");
	t.falsy(ModuleName.getDebugName("a"));
});

test("test ModuleName getNonDebugName", (t) => {
	t.is(ModuleName.getNonDebugName("a-dbg.controller.js"), "a.controller.js");
	t.is(ModuleName.getNonDebugName("a-dbg.css"), "a.css");
	t.falsy(ModuleName.getNonDebugName("a"));
});

test("test ModuleName resolveRelativePath", (t) => {
	t.is(ModuleName.resolveRelativePath("a/b/c", "c/x"), "c/x");
	t.is(ModuleName.resolveRelativePath("a/b/c.g", "c.g/x"), "c.g/x");
	t.is(ModuleName.resolveRelativePath("a/b/c.g", "gg"), "gg");
	t.falsy(ModuleName.resolveRelativePath("a"));
	t.is(ModuleName.resolveRelativePath("a/b/c/./g", "./g/./x"), "a/b/c/./g/x");
	t.is(ModuleName.resolveRelativePath("a/b/c/:/g", "c.g/x"), "c.g/x");
	t.is(ModuleName.resolveRelativePath("a/b/c/../g", "c.g/x"), "c.g/x");
});
