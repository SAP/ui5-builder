const {test} = require("ava");
const chai = require("chai");
chai.use(require("chai-fs"));

const typeRepository = require("../../../lib/types/typeRepository");

test("type retrieval", (t) => {
	const myType = {};
	typeRepository.addType("myTypeR", myType);
	const type = typeRepository.getType("myTypeR");
	t.is(type, myType, "type is successfully retrieved");
});

test("Unknown type retrieval", (t) => {
	const error = t.throws(() => {
		typeRepository.getType("not-existing");
	}, Error);
	t.is(error.message, "Unknown type 'not-existing'", "Retrieving a type by an non-existing key should fail");
});

test("Duplicate type", (t) => {
	const myType = {};
	typeRepository.addType("myType", myType);
	const error = t.throws(() => {
		typeRepository.addType("myType", myType);
	}, Error);
	t.is(error.message, "Type already registered 'myType'",
		"Registering two types with the same key should throw an error");
});

