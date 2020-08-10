/*!
 * UI development toolkit for HTML5 (OpenUI5)
 * (c) Copyright 2009-xxx SAP SE or an SAP affiliate company.
 * Licensed under the Apache License, Version 2.0 - see LICENSE.txt.
 */
sap.ui.define(["sap/ui/fl/changeHandler/BaseRename","../changeHandler/SplitButton"],function(e,n){"use strict";return{hideControl:"default",split:n,rename:e.createRenameChangeHandler({propertyName:"text",translationTextType:"XBUT"}),unhideControl:"default"}});