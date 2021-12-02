//@ui5-bundle sap-ui-core-nojQuery.js
jQuery.sap.registerPreloadedModules({
"version":"2.0",
"modules":{
	"sap/ui/core/Core.js":function(){
//# sourceMappingURL=Core.js.map
}
}});
sap.ui.requireSync("sap/ui/core/Core");
// as this module contains the Core, we ensure that the Core has been booted
sap.ui.getCore().boot && sap.ui.getCore().boot();
