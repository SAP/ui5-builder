//@ui5-bundle application/g/Component-h2-preload.js
sap.ui.require.preload({
	"application/g/manifest.json":'{"_version":"1.1.0","sap.app":{"_version":"1.1.0","id":"application.g","type":"application","applicationVersion":{"version":"1.0.0"},"embeds":["embedded"],"title":"{{title}}"},"customCopyrightString":"Some fancy copyright"}'
});
sap.ui.loader.config({depCacheUI5:{
"application/g/Component.js": ["sap/ui/core/UIComponent.js"]
}});
