const {test} = require("ava");
const esprima = require("esprima");
const ASTUtils = require("../../../../lib/lbt/utils/ASTUtils");


test("test ASTUtils isString", (t) => {
	t.false(ASTUtils.isString(null));


	const literal = esprima.parse("'asd'").body[0].expression;

	t.true(ASTUtils.isString(literal));
	t.true(ASTUtils.isString(literal, "asd"));
});


test("test ASTUtils isIdentifier", (t) => {
	const literal = esprima.parse("'asd'").body[0].expression;

	t.false(ASTUtils.isIdentifier(literal));


	const identifier = esprima.parse("asd").body[0].expression;

	t.true(ASTUtils.isIdentifier(identifier, ["*"]));
	t.true(ASTUtils.isIdentifier(identifier, ["asd"]));
	t.true(ASTUtils.isIdentifier(identifier, "asd"));

	t.false(ASTUtils.isIdentifier(identifier, []));
});


test("test ASTUtils isNamedObject", (t) => {
	const identifier = esprima.parse("asd").body[0].expression;
	t.true(ASTUtils.isNamedObject(identifier, ["asd"], 1));


	const member = esprima.parse("x.asd").body[0].expression;
	t.true(ASTUtils.isNamedObject(member, ["x", "asd"], 2));
});

test("test ASTUtils isMethodCall", (t) => {
	const identifier = esprima.parse("asd").body[0].expression;
	t.false(ASTUtils.isMethodCall(identifier));


	const methodCall = esprima.parse("asd()").body[0].expression;
	t.true(ASTUtils.isMethodCall(methodCall, ["asd"]));
});

test("test ASTUtils getStringArray", (t) => {
	const array = esprima.parse("['a', 5]").body[0].expression;
	const error = t.throws(() => {
		ASTUtils.getStringArray(array);
	}, TypeError);

	t.is(error.message, "array element is not a string literal:Literal");

	const stringArray = esprima.parse("['a', 'x']").body[0].expression;
	t.deepEqual(ASTUtils.getStringArray(stringArray), ["a", "x"]);
});

test("test ASTUtils getLocation", (t) => {
	t.is(ASTUtils.getLocation(), "");
});

test("test ASTUtils getPropertyKey", (t) => {
	const object = esprima.parse("var myVar = {'a':'x'}").body[0].declarations[0].init;

	t.deepEqual(ASTUtils.getPropertyKey(object.properties[0]), "a");

	const object2 = esprima.parse("var myVar = {a:'x'}").body[0].declarations[0].init;
	t.deepEqual(ASTUtils.getPropertyKey(object2.properties[0]), "a");
});

test("test ASTUtils findOwnProperty", (t) => {
	const literal = esprima.parse("'x'").body[0].expression;
	const object = esprima.parse("var myVar = {'a':'x'}").body[0].declarations[0].init;

	t.deepEqual(ASTUtils.findOwnProperty(object, "a"), literal);

	const object2 = esprima.parse("var myVar = {a:'x'}").body[0].declarations[0].init;
	t.deepEqual(ASTUtils.findOwnProperty(object2, "a"), literal);
});

test("test ASTUtils getValue", (t) => {
	t.falsy(ASTUtils.getValue(null, []));
	t.falsy(ASTUtils.getValue(null, ["a"]));

	const literal = esprima.parse("'x'").body[0].expression;
	const object = esprima.parse("var myVar = {'a':'x'}").body[0].declarations[0].init;

	t.deepEqual(ASTUtils.getValue(object, ["a"]), literal);

	const object2 = esprima.parse("var myVar = {a:'x'}").body[0].declarations[0].init;
	t.deepEqual(ASTUtils.getValue(object2, ["a"]), literal);
});
