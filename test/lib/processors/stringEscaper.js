const test = require("ava");

const stringEscaper = require("../../../lib/processors/stringEscaper");

/**
 * Executes string escaping. Returns <code>undefined</code> if nothing was escaped.
 *
 * @param {string} input string
 * @returns {Promise<string|undefined>} escaped string if non-ascii characters present, <code>undefined</code> otherwise
 */
const escape = async function(input) {
	let result = undefined;
	const resource = {
		getString: () => Promise.resolve(input),
		setString: (actual) => {
			result = actual;
		}
	};
	await stringEscaper({resources: [resource]});
	return result;
};

test("Replace symbol characters", async (t) => {
	t.plan(1);

	const input = `L♥VE is everywhere`;
	const expected = `L\\u2665VE is everywhere`;
	const output = await escape(input);
	t.deepEqual(output, expected, "Correct file content should be set");
});

test("Replace chinese characters", async (t) => {
	t.plan(1);

	const input = `These are 人物 characters`;
	const expected = "These are \\u4eba\\u7269 characters";
	const output = await escape(input);
	t.deepEqual(output, expected, "Correct file content should be set");
});

test("Replace umlaut characters", async (t) => {
	t.plan(1);

	const input = `Achso Ähem`;
	const expected = "Achso \\u00c4hem";
	const output = await escape(input);
	t.deepEqual(output, expected, "Correct file content should be set");
});

test("Replace constructed characters", async (t) => {
	t.plan(1);

	const input = `Oh ẛ̣ that's ẛ̣ yes`;
	const expected = "Oh \\u1e9b\\u0323 that's \\u1e9b\\u0323 yes";
	const output = await escape(input);
	t.deepEqual(output, expected, "Correct file content should be set");
});


test("Replace multiple times same character", async (t) => {
	t.plan(1);

	const input = `♥H L♥VE AND HARM♥NY ♥MG`;
	const expected = "\\u2665H L\\u2665VE AND HARM\\u2665NY \\u2665MG";
	const output = await escape(input);
	t.deepEqual(output, expected, "Correct file content should be set");
});

test("No Replace of characters", async (t) => {
	t.plan(1);

	const input = `ONE LOVE`;
	const expected = undefined;
	const output = await escape(input);
	t.deepEqual(output, expected, "Correct file content should not be modified");
});
