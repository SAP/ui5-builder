sap.ui.define([
	'static/module1'
], () => {
	// spread expression
	const dynamicModules = ["not-detected/module1"]; // TODO: should this be supported?
	sap.ui.require(["static/module1", ...dynamicModules]);
});
