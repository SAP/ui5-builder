//@ui5-bundle library/h/customBundle-dbg.js
sap.ui.require.preload({
	"library/h/file-dbg.js":function(){/*!
 * Some fancy copyright
 */
console.log(' File ');
},
	"library/h/library-dbg.js":function(){/*!
 * Some fancy copyright
 */
console.log(' Library ');
},
	"library/h/some-dbg.js":function(){/*!
 * Some fancy copyright
 */
//@ui5-bundle-raw-include library/h/other.js
console.log(' Some ');
}
});
//@ui5-bundle-raw-include library/h/not-dbg.js
/*!
 * Some fancy copyright
 */
console.log(' Not including ');
