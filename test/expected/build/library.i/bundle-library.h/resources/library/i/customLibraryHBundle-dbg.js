//@ui5-bundle library/i/customLibraryHBundle-dbg.js
sap.ui.require.preload({
	"library/h/file.js":function(){
/*!
 * Some fancy copyright
 */
console.log(' File ');
},
	"library/h/library.js":function(){
/*!
 * Some fancy copyright
 */
console.log(' Library ');
},
	"library/h/some.js":function(){
/*!
 * Some fancy copyright
 */
//@ui5-bundle-raw-include library/h/other.js
console.log(' Some ');
}
});
//@ui5-bundle-raw-include library/h/not.js
/*!
 * Some fancy copyright
 */
console.log(' Not including ');
//# sourceMappingURL=customLibraryHBundle-dbg.js.map
