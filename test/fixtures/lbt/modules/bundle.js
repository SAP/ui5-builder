sap.ui.predefine("sap/m/CheckBox", ["sap/ui/core/Control"], function(o) {
	"use strict"; const n=o.extend("sap.m.CheckBox"); return n;
});
sap.ui.predefine("sap/ui/core/Core", [], function() {
	"use strict"; return {};
});
sap.ui.predefine("todo/Component", ["sap/ui/core/UIComponent"], function(e) {
	"use strict"; return e.extend("todo.Component", {metadata: {manifest: "json"}});
});
sap.ui.predefine("todo/controller/App.controller", ["sap/ui/core/mvc/Controller"], function(e) {
	"use strict"; return e.extend("todo.controller.App");
});
jQuery.sap.registerPreloadedModules({
	"version": "2.0",
	"modules": {
		"sap/m/messagebundle.properties": "#This is the resource bundle for the SAPUI5 sar\r\n",
		"todo/manifest.json": "{\"sap.app\":{\"id\":\"todo\",\"type\":\"application\"},\"sap.ui5\":{\"rootView\":{\"viewName\":\"todo.view.App\",\"type\":\"XML\",\"id\":\"app\"},\"models\":{\"i18n\":{\"type\":\"sap.ui.model.resource.ResourceModel\",\"settings\":{\"bundleName\":\"todo.i18n.messageBundle\"}},\"\":{\"type\":\"sap.ui.model.json.JSONModel\",\"settings\":\"/model/todoitems.json\"}},\"resources\":{\"css\":[{\"uri\":\"css/styles.css\"}]}}}",
		"todo/model/todoitems.json": "{\"newTodo\":\"\",\"todos\":[{\"title\":\"Start this app\",\"completed\":true},{\"title\":\"Learn OpenUI5\",\"completed\":false}],\"itemsRemovable\":true,\"someCompleted\":true,\"completedCount\":1}",
		"todo/view/App.view.xml": "<mvc:View xmlns:mvc=\"sap.ui.core.mvc\" xmlns=\"sap.m\" controllerName=\"todo.controller.App\" displayBlock=\"true\"><Shell><App><Page title=\"{i18n>TITLE}\" backgroundDesign=\"Solid\"><subHeader><Toolbar><SearchField\n\t\t\t\t\t\t\tliveChange=\"onSearch\"\n\t\t\t\t\t\t\twidth=\"100%\" /></Toolbar></subHeader><content><Input class=\"todoInput\" id=\"addTodoItemInput\" value=\"{/newTodo}\" placeholder=\"{i18n>INPUT_PLACEHOLDER}\" change=\"addTodo\" /><List id=\"todoList\" items=\"{/todos}\" selectionChange=\"toggleCompleted\"\n\t\t\t\t\t\tmode=\"MultiSelect\"\n\t\t\t\t\t\tgrowing=\"true\"\n\t\t\t\t\t\tgrowingScrollToLoad=\"true\"\n\t\t\t\t\t\tshowNoData=\"false\"\n\t\t\t\t\t\tshowSeparators=\"None\"\n\t\t\t\t\t\trememberSelections=\"false\"><infoToolbar><Toolbar\n\t\t\t\t\t\t\t\tvisible=\"{/someCompleted}\"\n\t\t\t\t\t\t\t\tid=\"idInfoToolbar\" ><Label id=\"idSelectedLabel\" text=\"{/completedCount} completed\"/></Toolbar></infoToolbar><CustomListItem selected=\"{completed}\"><Input class=\"todoListInput\" enabled=\"{=!${completed}}\" value=\"{title}\"/></CustomListItem></List></content><footer><Bar><contentMiddle><Button id=\"idClearCompleted\" enabled=\"{/itemsRemovable}\" icon=\"sap-icon://delete\" text=\"Clear completed ({/completedCount})\" press=\"clearCompleted\" /></contentMiddle></Bar></footer></Page></App></Shell></mvc:View>\n"
	}});
