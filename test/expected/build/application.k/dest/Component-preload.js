//@ui5-bundle application/k/Component-preload.js
jQuery.sap.registerPreloadedModules({
"version":"2.0",
"modules":{
	"application/k/Component.js":function(){sap.ui.define(["sap/ui/core/UIComponent"],function(n){"use strict";return n.extend("application.k.Component",{metadata:{manifest:"json"}})});
},
	"application/k/changes/coding/MyExtension.js":function(){sap.ui.define([],function(){return{}});
},
	"application/k/changes/flexibility-bundle.json":'{"changes":[{"fileName":"id_456_addField","fileType":"change","changeType":"hideControl","component":"application.k.Component","content":{},"selector":{"id":"control1"},"layer":"VENDOR","texts":{},"namespace":"apps/application.k.Component/changes","creation":"2023-10-30T13:52:40.4754350Z","originalLanguage":"","conditions":{},"support":{"generator":"did it","user":"Max Mustermann"}},{"fileName":"id_123_addField","fileType":"change","changeType":"hideControl","component":"application.k.Component","content":{},"selector":{"id":"control1"},"layer":"VENDOR","texts":{},"namespace":"apps/application.k.Component/changes","creation":"2025-10-30T13:52:40.4754350Z","originalLanguage":"","conditions":{},"support":{"generator":"did it","user":"Max Mustermann"}}],"compVariants":[],"variants":[],"variantChanges":[],"variantDependentControlChanges":[],"variantManagementChanges":[]}',
	"application/k/changes/fragments/MyFragment.fragment.xml":'<xml></xml>',
	"application/k/manifest.json":'{"_version":"1.1.0","sap.app":{"_version":"1.1.0","id":"application.k","type":"application","applicationVersion":{"version":"1.2.2"},"embeds":["embedded"],"title":"{{title}}"},"sap.ui5":{"dependencies":{"minUI5Version":"1.73.0","libs":{"sap.ui.layout":{},"sap.ui.core":{},"sap.m":{},"sap.ui.fl":{}}}}}'
}});
