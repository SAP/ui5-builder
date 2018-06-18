//@ui5-bundle application/i/Component-h2-preload.js
sap.ui.require.preload({
	"application/i/manifest.json":'{"_version":"1.1.0","sap.app":{"_version":"1.1.0","id":"application.i","type":"application","applicationVersion":{"version":"1.2.2"},"embeds":["embedded"],"title":"{{title}}"},"sap.ui5":{"dependencies":{"libs":{"sap.ui.layout":{},"sap.ui.core":{},"sap.m":{},"sap.ui.fl":{}}}}}'
});
sap.ui.loader.config({depCacheUI5:{
"application/i/Component.js": ["sap/ui/core/UIComponent.js","sap/ui/layout/library.js","sap/ui/core/library.js","sap/m/library.js","sap/ui/fl/library.js"]
}});
