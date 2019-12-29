/*!
 * UI development toolkit for HTML5 (OpenUI5)
 * (c) Copyright 2009-xxx SAP SE or an SAP affiliate company.
 * Licensed under the Apache License, Version 2.0 - see LICENSE.txt.
 */
sap.ui.define(["./library","sap/ui/core/Control"],function(e,t){"use strict";return t.extend("library.n.Button",{metadata:{library:"library.n",properties:{text:{type:"string",group:"Misc",defaultValue:""}},aggregations:{icon:{type:"sap.ui.core.Control",cardinality:"0..1"}},events:{press:{}}},designtime:"library/n/designtime/Button.designtime",renderer:{apiVersion:2,render:function(e,t){e.openStart("button",t);e.class("libNBtnBase");e.openEnd();if(t.getIcon()){e.renderControl(t.getIcon())}e.openStart("span",t.getId()+"-content");e.class("libNBtnContent");e.openEnd();e.text(sText);e.close("span");e.close("button")}}})});