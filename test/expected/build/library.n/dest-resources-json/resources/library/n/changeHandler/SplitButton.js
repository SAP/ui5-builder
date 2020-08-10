/*!
 * UI development toolkit for HTML5 (OpenUI5)
 * (c) Copyright 2009-xxx SAP SE or an SAP affiliate company.
 * Licensed under the Apache License, Version 2.0 - see LICENSE.txt.
 */
sap.ui.define(["sap/ui/core/util/reflection/JsControlTreeModifier"],function(e){"use strict";var t={};SplitButton.applyChange=function(e,t,r){if(r.modifier.targets!=="jsControlTree"){throw new Error("SplitButton change can't be applied on XML tree")}return true};SplitButton.revertChange=function(e,t,r){e.resetRevertData();return true};return t});