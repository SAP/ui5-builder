
import {parseJS, Syntax, VisitorKeys} from "../utils/parseUtils.js";
import {getPropertyKey, isMethodCall, isIdentifier, getStringArray} from "../utils/ASTUtils.js";
import {getLogger} from "@ui5/logger";
const log = getLogger("lbt:analyzer:LibraryJS");

const CALL__SAP_UI_GETCORE = ["sap", "ui", "getCore"];
const AMD__LIB_INIT_RESOURCES = {
	// Depenedency definition: inti library method name
	"sap/ui/core/Core": "initLibrary",
	"sap/ui/core/Lib": "init",
};

/*
 * Static Code Analyzer that extracts library information from the sap.ui.getCore().initLibrary()
 * call in a library.js module.
 */
async function analyze(resource) {
	const libInfo = {
		noLibraryCSS: false,
		types: [],
		controls: [],
		elements: [],
		interfaces: []
	};

	function visit(node) {
		if (isInitLibraryCall(node)) {
			node.arguments[0].properties.forEach( (prop) => {
				if (prop.type === Syntax.SpreadElement) {
					// SpreadElements are currently not supported
					return;
				}

				const key = getPropertyKey(prop);
				const value = prop.value;

				if ( key === "noLibraryCSS" &&
						(value.type === Syntax.Literal && typeof value.value === "boolean") ) {
					libInfo.noLibraryCSS = value.value;
				} else if ( key === "types" && value.type == Syntax.ArrayExpression ) {
					libInfo.types = getStringArray(value, true);
				} else if ( key === "interfaces" && value.type == Syntax.ArrayExpression ) {
					libInfo.interfaces = getStringArray(value, true);
				} else if ( key === "controls" && value.type == Syntax.ArrayExpression ) {
					libInfo.controls = getStringArray(value, true);
				} else if ( key === "elements" && value.type == Syntax.ArrayExpression ) {
					libInfo.elements = getStringArray(value, true);
				} else if ( ["designtime", "dependencies", "extensions", "name", "version"].includes(key) ) {
					// do nothing, for all other supported properties
				} else {
					log.error(
						"Unexpected property '" + key +
						"' or wrong type for '" + key +
						"' in sap.ui.getCore().initLibrary call in '" + resource.getPath() + "'"
					);
				}
			});

			return true; // abort, we're done
		}

		for ( const key of VisitorKeys[node.type] ) {
			const child = node[key];
			if ( Array.isArray(child) ) {
				if ( child.some(visit) ) {
					return true;
				}
			} else if ( child ) {
				if ( visit(child) ) {
					return true;
				}
			}
		}

		return false;
	}

	const code = await resource.getBuffer();
	visit( parseJS(code) );

	return libInfo;
}

const initLibraryDefintions = [];
/**
 * Determines whether the node is a initLibrary call.
 *
 * @param {Node} node
 * @returns {boolean}
 */
function isInitLibraryCall(node) {
	// sap.ui.getCore()
	if (
		node.type == Syntax.CallExpression &&
		node.callee.type === Syntax.MemberExpression &&
		isMethodCall(node.callee.object, CALL__SAP_UI_GETCORE) &&
		isIdentifier(node.callee.property, "initLibrary") &&
		node.arguments.length === 1 &&
		node.arguments[0].type === Syntax.ObjectExpression
	) {
		return true;
	}

	// Find whether there's potential initLibrary() dependency in AMD i.e. "sap/ui/core/Core"
	if (node.type === Syntax.Program && !initLibraryDefintions.length) {
		const amdDepDefinitions = node.body[0].expression.arguments[0].elements;
		const amdFnArguments = node.body[0].expression.arguments[1].params;

		for (let i = 0; i < amdFnArguments.length; i++) {
			const fnArgName = amdFnArguments[i].name; // Name of the variable
			const amdDef = amdDepDefinitions[i].value;
			if (AMD__LIB_INIT_RESOURCES[amdDef]) {
				// Add just the ones that are available
				initLibraryDefintions.push([fnArgName, AMD__LIB_INIT_RESOURCES[amdDef]]);
			}
		}
	}

	// Find a CallExpression with the names that match the
	// library initialization methods
	if (
		node.type === Syntax.CallExpression &&
		node.callee.type === Syntax.MemberExpression &&
		// Filtered list of [["Library", "init"], ["Core", "initLibrary"]]
		initLibraryDefintions.some((libArgs) =>
			isMethodCall(node, libArgs) &&
			isIdentifier(node.callee.property, libArgs[1])
		) &&
		node.arguments.length === 1 &&
		node.arguments[0].type === Syntax.ObjectExpression
	) {
		return true;
	}

	return false;
}

/**
 * Creates a new analyzer and executes it on the given resource.
 *
 * If the resources exists and can be parsed as JavaScript and if an sap.ui.getCore().initLibrary()
 * call is found in the code, then the following information will be set:
 * <ul>
 * <li>noLibraryCSS: false when the noLibraryCSS property had been set in the initLibrary info object)</li>
 * <li>types: string array with the names of the types contained in the library</li>
 * <li>controls: string array with the names of the controls defined in the library</li>
 * <li>elements: string array with the names of the elements defined in the library</li>
 * <li>interfaces: string array with the names of the interfaces defined in the library</li>
 * </ul>
 *
 * Note: only the first initLibrary() call that is found with a DFS on the AST, will be evaluated.
 *
 * @param {@ui5/fs/Resource} resource library.js resource whose content should be analyzed
 * @returns {Promise<object>} A Promise on the extract info object
 */
export default function(resource) {
	if ( resource == null ) {
		return Promise.resolve({});
	}
	return analyze(resource);
}
