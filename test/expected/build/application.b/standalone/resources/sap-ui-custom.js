//@ui5-bundle sap-ui-custom.js
//@ui5-bundle-raw-include ui5loader-autoconfig.js
(function(){var o=true;console.log(o)})();
sap.ui.require.preload({
	"id1/embedded/i18n/i18n.properties":'title=embedded-i18n',
	"id1/embedded/i18n/i18n_de.properties":'title=embedded-i18n_de',
	"id1/embedded/i18n_fr.properties":'title=embedded-i18n_fr-wrong',
	"id1/embedded/manifest.json":'{"_version":"1.1.0","sap.app":{"_version":"1.1.0","id":"id1.embedded","type":"component","applicationVersion":{"version":"1.2.2"},"embeddedBy":"../","title":"{{title}}"}}',
	"id1/i18n.properties":'title=app-i18n-wrong\nfame=Stra\\u00dfe',
	"id1/i18n/i18n.properties":'title=app-i18n\nfame=Stra\\u00dfe',
	"id1/i18n/i18n_de.properties":'title=app-i18n_de\nfame=Stra\\u00dfe',
	"id1/i18n/l10n.properties":'title=app-i18n-wrong\nfame=Stra\\u00dfe',
	"id1/manifest.json":'{"_version":"1.1.0","sap.app":{"_version":"1.1.0","id":"id1","type":"application","applicationVersion":{"version":"1.2.2"},"embeds":["embedded"],"title":"{{title}}"}}',
	"sap/ui/core/Core.js":function(){
(function(){var o=true;console.log(o)})();
}
});
sap.ui.requireSync("sap/ui/core/Core");
// as this module contains the Core, we ensure that the Core has been booted
sap.ui.getCore().boot && sap.ui.getCore().boot();
//# sourceMappingURL=sap-ui-custom.js.map
