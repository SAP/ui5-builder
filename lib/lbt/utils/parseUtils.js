"use strict";

const espree = require("espree");
const {Syntax, VisitorKeys} = espree;

const hasOwn = Function.prototype.call.bind(Object.prototype.hasOwnProperty);

function parseJS(code, userOptions = {}) {
	// allowed options and their defaults
	const options = {
		comment: false,
		ecmaVersion: 2021, // NOTE: Adopt JSModuleAnalyzer.js to allow new Syntax when upgrading to newer ECMA versions
		range: false,
		sourceType: "script",
	};

	// validate and assign options
	for (const [name, value] of Object.entries(userOptions)) {
		if (!hasOwn(options, name)) {
			throw new TypeError(`Allowed parser options are ${Object.keys(options)}, but not '${name}'`);
		}
		options[name] = value;
	}

	return espree.parse(code, options);
}

const ConditionalVisitorKeys = (function() {
	function toBeDone() {
		return null;
	}

	/*
	 * The following object contains for each known estree node type
	 * a list of visitor keys that represent conditionally executed code branches.
	 * E.g. in an IfExpression, the 'test' is always executed, whereas 'consequent'
	 * and 'alternate' are only executed under certain conditions.
	 *
	 * While visiting the AST of a JavaScript file, the JSModuleAnalyzer uses this information
	 * to decide whether a code block is executed conditionally or unconditionally.
	 * Besides this information which is inherent to the language, the analyzer uses
	 * additional knowledge about special APIS / constructs (e.g. the factory function of
	 * an AMD module is known to be executed when the module is executed, an IIFE is known to
	 * be executed etc.)
	 *
	 * To be more robust against the evolution of the language, the object below is checked
	 * against the 'official' list of node types and node keys as defined by 'espree'.
	 * This helps to ensure that no new syntax addition is missed and that the configured
	 * keys are valid.
	 */
	const TempKeys = {
		AssignmentExpression: [],
		/*
		 * function( >>>a=3<<<, b) {...}
		 * var [>>>a=3<<<, b] = [...];
		 *
		 * The default value expression (right) is only evaluated when there's no other value in
		 * the context of the pattern (e.g. destructuring or function call don't provide a value),
		 * so it's a conditional branch.
		 */
		AssignmentPattern: ["right"],
		ArrayExpression: [],
		/*
		 * var >>>[a=3, b]<<< = [...];
		 * All elements in an array pattern are unconditional.
		 */
		ArrayPattern: [], // elements
		/*
		 * The body of an arrow function is only executed when the arrow function is executed
		 */
		ArrowFunctionExpression: ["body"],
		/*
		 * The argument of await is always executed
		 * TODO how to handle code after the await expression?
		 */
		AwaitExpression: [], // argument
		BlockStatement: [],
		BinaryExpression: [],
		BreakStatement: [],
		CallExpression: [], // special handling
		CatchClause: ["param", "body"],
		ChainExpression: [],
		ClassBody: [],
		ClassDeclaration: [],
		ClassExpression: [],
		// ComprehensionBlock: toBeDone(["left", "right"]),	// CAUTION: It's deferred to ES7.
		// ComprehensionExpression: toBeDone(),	// CAUTION: It's deferred to ES7.
		ConditionalExpression: ["consequent", "alternate"],
		ContinueStatement: [],
		DebuggerStatement: [],
		/*
		 * 'condition' is executed on the same conditions as the surrounding block, potentially repeated,
		 * 'block' is always entered and might be repeated
		 */
		DoWhileStatement: [],
		EmptyStatement: [],
		ExportAllDeclaration: [], // no parts of an export are conditional - source
		ExportDefaultDeclaration: [], // no parts of an export are conditional - declaration
		ExportNamedDeclaration: [], // no parts of an export are conditional - declaration, specifiers, source
		ExportSpecifier: [], // no parts of an export are conditional exported, local
		ExpressionStatement: [],
		ForStatement: ["update", "body"],
		ForInStatement: ["body"],
		ForOfStatement: ["body"],
		FunctionDeclaration: ["body"], // a nested function is potentially 'conditional'
		FunctionExpression: ["body"], // a nested function is potentially 'conditional'
		// GeneratorExpression: toBeDone(["blocks", "filter", "body"]),	// CAUTION: It's deferred to ES7.
		Identifier: [],
		IfStatement: ["consequent", "alternate"],
		/*
		 * all parts of an import declaration are executed unconditionally
		 */
		ImportDeclaration: [], // specifiers, source
		/*
		 * import >>>a<<< from 'module';
		 */
		ImportDefaultSpecifier: [], // local
		/*
		 * Dynamic Import expression, the argument is evaluated unconditionally.
		 */
		ImportExpression: [], // source,
		/*
		 * import >>>* as b<<< from 'module';
		 */
		ImportNamespaceSpecifier: [], // local
		/*
		 * import {>>>a as c<<<,b} from 'module';
		 */
		ImportSpecifier: [], // imported, local
		Literal: [],
		LabeledStatement: [],
		LogicalExpression: [],
		MemberExpression: [],
		MetaProperty: toBeDone(["meta", "property"]),
		MethodDefinition: [],
		NewExpression: [],
		ObjectExpression: [],
		/*
		 * >>>{a,b,c}<<< = {...}
		 *
		 * All properties in an object pattern are executed.
		 */
		ObjectPattern: [], // properties
		// PrivateIdentifier: [], // will come with ES2022
		Program: [],
		Property: [],
		// PropertyDefinition: [], // will come with ES2022
		/*
		 * argument of the rest element is always executed under the same condition as the rest element itself
		 */
		RestElement: [], // argument
		ReturnStatement: [],
		SequenceExpression: [],
		SpreadElement: [], // the argument of the spread operator always needs to be evaluated - argument
		// StaticBlock: [], // will come with ES2022
		Super: [],
		SwitchStatement: [],
		SwitchCase: ["test", "consequent"], // test and consequent are executed only conditionally
		/*
		 * all parts of a tagged template literal are executed under the same condition as the context
		 */
		TaggedTemplateExpression: [], // tag, quasi
		TemplateElement: [],
		/*
		 * all parts of a template literal are executed under the same condition as the context
		 */
		TemplateLiteral: [], // quasis, expressions
		ThisExpression: [],
		ThrowStatement: [],
		TryStatement: ["handler"], // handler is called conditionally
		UnaryExpression: [],
		UpdateExpression: [],
		VariableDeclaration: [],
		VariableDeclarator: [],
		/*
		 * 'condition' is executed on the same conditions as the surrounding block and potentially repeated,
		 * 'block' maybe entered only conditionally but can be repeated
		 */
		WhileStatement: ["body"],
		WithStatement: [],
		YieldExpression: []
	};

	// check for unknown keys in our configuration
	for ( const type in TempKeys ) {
		if ( VisitorKeys[type] === undefined ) {
			throw new Error("configuration contains unknown node type '" + type + "'");
		}
	}

	// merge with 'official' visitor keys
	Object.keys(VisitorKeys).forEach( (type) => {
		// Ignore deprecated keys:
		// - ExperimentalSpreadProperty => SpreadElement
		// - ExperimentalRestProperty => RestElement
		// They are about to be removed, see: https://github.com/eslint/eslint-visitor-keys/pull/36
		if (type === "ExperimentalSpreadProperty" || type === "ExperimentalRestProperty") {
			return;
		}
		// Ignore JSX visitor-keys because they aren't used.
		if (type.startsWith("JSX")) {
			return;
		}

		// Ignore new ES2022 syntax as we currently use ES2021 (see parseUtils.js)
		if (
			type === "PrivateIdentifier" ||
			type === "PropertyDefinition" ||
			type === "StaticBlock"
		) {
			return;
		}

		const visitorKeys = VisitorKeys[type];
		const condKeys = TempKeys[type];
		if ( condKeys === undefined ) {
			// configuration missing in ConditionalKeys, maybe a new syntax ?
			throw new Error(`unknown estree node type '${type}', new syntax?`);
		} else if ( Array.isArray(condKeys) ) {
			// check configured keys against visitor keys
			condKeys.forEach( (key) => {
				if ( visitorKeys.indexOf(key) < 0 ) {
					throw new Error(`configuration for type '${type}' contains unknown key '${key}'`);
				}
			});
			TempKeys[type] = visitorKeys.map( (key) => ({
				key: key,
				conditional: condKeys.indexOf(key) >= 0
			}) );
		} else {
			// this is a 'toBeDone' node type, keep null and complain at runtime when such a node occurs
		}
	});

	return TempKeys;
}());

module.exports = {
	parseJS,
	Syntax,
	VisitorKeys,
	ConditionalVisitorKeys
};
