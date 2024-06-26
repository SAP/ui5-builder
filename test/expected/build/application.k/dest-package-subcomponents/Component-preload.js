//@ui5-bundle application/k/Component-preload.js
sap.ui.predefine("application/k/Component", ["sap/ui/core/UIComponent"], function(UIComponent){
	"use strict";
	return UIComponent.extend('application.k.Component', {
		metadata: {
			manifest: "json"
		}
	});
});
sap.ui.predefine("application/k/subcomponentA/Component", ["sap/ui/core/UIComponent"], function(UIComponent){
	"use strict";
	return UIComponent.extend('application.k.subcomponentA.Component', {
		metadata: {
			manifest: "json"
		}
	});
});
sap.ui.predefine("application/k/subcomponentB/Component", ["sap/ui/core/UIComponent"], function(UIComponent){
	"use strict";
	return UIComponent.extend('application.k.subcomponentB.Component', {
		metadata: {
			manifest: "json"
		}
	});
});
sap.ui.require.preload({
	"application/k/manifest.json":'{"_version":"1.1.0","sap.app":{"_version":"1.1.0","id":"application.k","type":"application","applicationVersion":{"version":"${version}"},"embeds":["embedded"],"title":"{{title}}"},"customCopyrightString":"${copyright}"}',
	"application/k/subcomponentA/manifest.json":'{"_version":"1.1.0","sap.app":{"_version":"1.1.0","id":"application.k.subcomponentA","type":"application","applicationVersion":{"version":"1.2.2"},"embeds":["embedded"],"title":"{{title}}"}}',
	"application/k/subcomponentB/manifest.json":'{"_version":"1.1.0","sap.app":{"_version":"1.1.0","id":"application.k.subcomponentB","type":"application","applicationVersion":{"version":"1.2.2"},"embeds":["embedded"],"title":"{{title}}"}}',
	"application/k/subcomponentB/thirdparty/lib.js":function(){
console.log("subcomponentB/thirdparty/lib.js");
}
});
//# sourceMappingURL=Component-preload.js.map
