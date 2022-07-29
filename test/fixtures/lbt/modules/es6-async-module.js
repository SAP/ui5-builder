// async function with await
sap.ui.define([], async () => {
	return await sap.ui.require(["static/module1"], async () => {});
	// await and sap.ui.require, makes so sense because it does NOT return a promise but it should still be analyzed
});
