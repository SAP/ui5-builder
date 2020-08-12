/*!
 * UI development toolkit for HTML5 (OpenUI5)
 * (c) Copyright 2009-xxx SAP SE or an SAP affiliate company.
 * Licensed under the Apache License, Version 2.0 - see LICENSE.txt.
 */
sap.ui.define(["sap/ui/core/Control"],function(e){"use strict";return e.extend("library.n.Button",{renderer:{render:function(e,r){sap.ui.requireSync("library/n/changeHandler/SplitButton")}},helper:function(e){var r="sap/ui/core/date/"+e;sap.ui.require(["sap/ui/core/format/DateFormat",r],function(e,r){e.getInstance();new r})}})});