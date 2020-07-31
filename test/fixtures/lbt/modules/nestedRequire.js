/*!
 * ${copyright}
 */

/*
 * IMPORTANT: This is a private module, its API must not be used and is subject to change.
 * Code other than the Core tests must not yet introduce dependencies to this module.
 */

/*global document, sap */
(function(deps, callback) {

	"use strict";

	//extract base URL from script tag
	var oScriptTag, mMatch, sBaseUrl;

	oScriptTag = document.querySelector("[src$='myfile.js']");
	if (oScriptTag) {
		mMatch = /^(.*\/)?myfile.js/.exec(oScriptTag.getAttribute("src"));
		if (mMatch) {
			sBaseUrl = mMatch[1] + "../../../../";
		}
	}

	if (sBaseUrl == null) {
		throw new Error("myfile.js: could not identify script tag!");
	}

	function loadScripts(urls, callback) {
		var pending = urls.length,
			errors = 0;

		if (pending === 0) {
			callback();
			return;
		}

		function listener(e) {
			pending--;
			if ( e.type === 'error' ) {
				errors++;
			}
			e.target.removeEventListener("load", listener);
			e.target.removeEventListener("error", listener);
			if ( pending === 0 && errors === 0 && callback ) {
				callback();
			}
		}

		for ( var i = 0; i < urls.length; i++ ) {
			var script = document.createElement("script");
			script.addEventListener("load", listener);
			script.addEventListener("error", listener);
			script.src = sBaseUrl + urls[i];
			document.head.appendChild(script);
		}
	}

	// define the necessary polyfills to be loaded
	var aPolyfills = [];

	// cascade 1: polyfills, can all be loaded in parallel
	loadScripts(aPolyfills, function() {
		// cascade 2: the loader
		loadScripts([
			"ui5loader.js"
		], function() {
			// cascade 3: the loader configuration script
			sap.ui.loader.config({
				async:true
			});
			loadScripts([
				"ui5loader-autoconfig.js"
			], function() {
				sap.ui.require(deps, callback);
			});
		});
	});

}([
	"sap/ui/test/starter/_utils"
], function(utils) {
	"use strict";

	var oSuiteReadyEvent = document.createEvent("CustomEvent");
	oSuiteReadyEvent.initCustomEvent("sap-ui-testsuite-ready", true, true, {});
	window.dispatchEvent(oSuiteReadyEvent);

}));