/*!
 * UI development toolkit for HTML5 (OpenUI5)
 * (c) Copyright 2009-xxx SAP SE or an SAP affiliate company.
 * Licensed under the Apache License, Version 2.0 - see LICENSE.txt.
 */
sap.ui.define([],function(){"use strict";return{palette:{group:"ACTION",icons:{svg:"library/n/designtime/Button.icon.svg"}},actions:{combine:{changeType:"combineButtons",changeOnRelevantContainer:true,isEnabled:true},remove:{changeType:"hideControl"},split:{changeType:"split"},rename:{changeType:"rename",domRef:function(e){return e.$().find(".libNBtnContent")[0]}},reveal:{changeType:"unhideControl"}},templates:{create:"library/n/designtime/Button.create.fragment.xml"}}});