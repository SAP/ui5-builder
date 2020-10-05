//@ui5-bundle application.g/Component-preload.js
sap.ui.predefine("application.g/Component",["sap/ui/core/UIComponent"],function(n){"use strict";return n.extend("application.g.Component",{metadata:{manifest:"json"}})});
sap.ui.predefine("application.g/subcomponentA/Component",["sap/ui/core/UIComponent"],function(n){"use strict";return n.extend("application.g.subcomponentA.Component",{metadata:{manifest:"json"}})});
sap.ui.predefine("application.g/subcomponentB/Component",["sap/ui/core/UIComponent"],function(n){"use strict";return n.extend("application.g.subcomponentB.Component",{metadata:{manifest:"json"}})});
jQuery.sap.registerPreloadedModules({
"version":"2.0",
"modules":{
	"application.g/manifest.json":'{"_version":"1.1.0","sap.app":{"_version":"1.1.0","id":"application.g","type":"application","applicationVersion":{"version":"1.0.0"},"embeds":["embedded"],"title":"{{title}}"},"customCopyrightString":"Some fancy copyright"}',
	"application.g/subcomponentA/manifest.json":'{"_version":"1.1.0","sap.app":{"_version":"1.1.0","id":"application.g.subcomponentA","type":"application","applicationVersion":{"version":"1.2.2"},"embeds":["embedded"],"title":"{{title}}"}}',
	"application.g/subcomponentB/manifest.json":'{"_version":"1.1.0","sap.app":{"_version":"1.1.0","id":"application.g.subcomponentB","type":"application","applicationVersion":{"version":"1.2.2"},"embeds":["embedded"],"title":"{{title}}"}}'
}});
//# sourceMappingURL=Component-preload.js.map
