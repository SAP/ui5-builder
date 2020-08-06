var sCommonName = "sap.ui"
jQuery.sap.declare(sCommonName + ".testmodule");

sap.ui.testmodule.load = function(modName) {
	jQuery.sap.require(modName);
};
