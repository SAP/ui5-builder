/*!
 * ${copyright}
 */

/**
 * FEATURE TO INCREASE DEVELOPMENT EXPERIENCE! NO PRODUCTIVE USAGE ALLOWED!
 */
(function() {
	"use strict";

	/**
	 * wraps the definition of the MyFile in order to be able to delay
	 * the definition until the body is loaded and sap.ui.define is available
	 */
	function defineMyFile() {

		// Provides class sap.ui.core.plugin.MyFile
		sap.ui.define('sap/ui/core/plugin/MyFile', [
				'sap/ui/thirdparty/jquery'],
			function(jQuery) {

				/**
				 * Creates an instance of the class <code>sap.ui.core.plugin.MyFile</code>
				 *
				 * @version ${version}
				 * @private
				 * @alias sap.ui.core.plugin.MyFile
				 */
				var MyFile = function() {
				};


				/**
				 * Create the <code>sap.ui.core.plugin.MyFile</code> plugin and
				 * register it within the <code>sap.ui.core.Core</code>.
				 */
				var oThis = new MyFile();
				sap.ui.getCore().registerPlugin(oThis);

				/**
				 * Triggers a less refresh and updates the theming parameters.
				 *
				 * @private
				 */
				MyFile.refresh = function() {
				};

				return MyFile;

			});

	}

	// check for "sap.ui.define" being already available
	//  - when available immediately define the MyFile
	//  - if not we delay the definition till the body is loaded
	if (!(window.sap && window.sap.ui && window.sap.ui.define)) {
		var fnHandler = function() {
			document.removeEventListener("DOMContentLoaded", fnHandler, false);
			defineMyFile();
		};
		document.addEventListener("DOMContentLoaded", fnHandler, false);
	} else {
		defineMyFile();
	}

}());