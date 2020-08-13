/*!
 * UI development toolkit for HTML5 (OpenUI5)
 * (c) Copyright 2009-xxx SAP SE or an SAP affiliate company.
 * Licensed under the Apache License, Version 2.0 - see LICENSE.txt.
 */
sap.ui.define(["mylib/MyFirstClass"],function(n){"use strict";return n.doIt("library.n.Button",{prop:{value:function(){sap.ui.requireSync("library/n/changeHandler/SplitButton")}},helper:function(n){var i="mylib/dyn/"+n;sap.ui.require(["mylib/MyClass",i],function(n,i){new n(i)})}})});