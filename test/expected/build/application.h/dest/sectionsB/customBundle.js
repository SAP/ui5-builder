//@ui5-bundle application/h/sectionsB/customBundle.js
jQuery.sap.registerPreloadedModules({
"version":"2.0",
"modules":{
	"application/h/sectionsB/section1-dbg.js":function(){sap.ui.define(["sap/m/Button"], function(Button) {
	console.log("Section 1 included");
});
},
	"application/h/sectionsB/section2-dbg.js":function(){sap.ui.define(["sap/m/Button"], function(Button) {
	console.log("Section 2 included");
});
},
	"application/h/sectionsB/section3-dbg.js":function(){sap.ui.define(["sap/m/Button"], function(Button) {
	console.log("Section 3 included");
});
}
}});
