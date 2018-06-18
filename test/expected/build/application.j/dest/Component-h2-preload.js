//@ui5-bundle application/j/Component-h2-preload.js
sap.ui.require.preload({
	"application/j/manifest.json":'{"_version":"1.1.0","sap.app":{"_version":"1.1.0","id":"application.j","type":"application","applicationVersion":{"version":"1.2.2"},"embeds":["embedded"],"title":"{{title}}"},"sap.ui5":{"dependencies":{"minUI5Version":"1.73.2","libs":{"sap.ui.layout":{},"sap.ui.core":{},"sap.m":{},"sap.ui.fl":{"lazy":false}}}}}'
});
sap.ui.loader.config({depCacheUI5:{
"application/j/Component.js": ["sap/ui/core/UIComponent.js","sap/ui/layout/library.js","sap/ui/core/library.js","sap/m/library.js","sap/ui/fl/library.js"]
}});
