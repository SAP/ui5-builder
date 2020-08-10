//@ui5-bundle library/h/customBundle.js
sap.ui.require.preload({
	"library/h/file.js":function(){/*!
 * Some fancy copyright
 */
console.log(" File ");
},
	"library/h/library.js":function(){/*!
 * Some fancy copyright
 */
console.log(" Library ");
},
	"library/h/some.js":'/*!\n * Some fancy copyright\n */\nvar myexport=function(){"use strict";String("asd")}();'
});
