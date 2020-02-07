const test = require("ava");

const resourceFactory = require("@ui5/fs").resourceFactory;

const mock = require("mock-require");
const sinon = require("sinon");

const logger = require("@ui5/logger");


function prepareResources() {
	const input =
		`@someColor: black;
.someClass {
	color: @someColor;
	padding: 1px 2px 3px 4px;
}`;

	const memoryAdapter = resourceFactory.createAdapter({
		virBasePath: "/"
	});

	const lessFilePath = "/resources/foo.less";

	const resource = resourceFactory.createResource({
		path: lessFilePath,
		string: input
	});

	memoryAdapter.write(resource);

	return {
		resource,
		memoryAdapter
	};
}


test.before((t) => {
	t.context.cleanCss = {};
	const cleanCssStub = sinon.stub().returns(t.context.cleanCss);
	mock("clean-css", cleanCssStub);

	t.context.warnLogStub = sinon.stub();
	sinon.stub(logger, "getLogger").returns({
		warn: t.context.warnLogStub
	});
});

test.after((t) => {
	mock.stop("clean-css");

	sinon.restore();
	mock.reRequire("clean-css");
});

test.afterEach.always((t) => {
	sinon.restore();
});

test.serial("cssOptimizer: Runtime error case", async (t) => {
	const {resource} = prepareResources();
	const cssOptimizer = require("../../../lib/processors/cssOptimizer");

	t.context.cleanCss.minify = function() {
		// eslint-disable-next-line prefer-promise-reject-errors
		return Promise.reject(["something bad happened"]);
	};

	const error = await t.throwsAsync(async ()=>{
		await cssOptimizer({resources: [resource]});
	});
	t.is(error.message, "Errors occurred: something bad happened", "Error message should be the same");
});

test.serial("cssOptimizer: warnings", async (t) => {
	const {resource} = prepareResources();

	t.context.cleanCss.minify = function() {
		return Promise.resolve({
			warnings: ["my warning"],
			styles: "mystyle"
		});
	};
	const cssOptimizer = require("../../../lib/processors/cssOptimizer");
	await cssOptimizer({resources: [resource]});
	t.deepEqual(t.context.warnLogStub.callCount, 1, "One message has been logged");
	t.deepEqual(t.context.warnLogStub.getCall(0).args[0], "Warnings occurred: my warning", "Warning message should be the same");
});
