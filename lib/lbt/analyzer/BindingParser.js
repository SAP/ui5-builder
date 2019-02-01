const ui5Factory = require("node-ui5/factory");

async function getBindingParser() {
	const {sap} = await ui5Factory({});
	return new Promise((resolve, reject) => {
		sap.ui.require(["sap/ui/base/BindingParser"], resolve, reject);
	});
}

module.exports.getBindingParser = getBindingParser;
