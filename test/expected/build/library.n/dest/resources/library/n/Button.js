/*!
 * some fancy copyright
 */
sap.ui.define(["mylib/MyFirstClass"],function(n){"use strict";return n.doIt("library.n.Button",{prop:{value:function(){sap.ui.requireSync("library/n/changeHandler/SplitButton")}},helper:function(n){var i="mylib/dyn/"+n;sap.ui.require(["mylib/MyClass",i],function(n,i){new n(i)})}})});