//@ui5-bundle application/h/sectionsB/customBundle.js
sap.ui.require.preload({
	"application/h/sectionsB/section1.js":function(){
sap.ui.define(["sap/m/Button"], function(Button) {
	console.log("Section 1 included");
});
},
	"application/h/sectionsB/section2.js":function(){
sap.ui.define(["sap/m/Button"], function(Button) {
	console.log("Section 2 included");
});
},
	"application/h/sectionsB/section3.js":function(){
sap.ui.define(["sap/m/Button"], function(Button) {
	console.log("Section 3 included");
});
}
});
//# sourceMappingURL=customBundle.js.map
