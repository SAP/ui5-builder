const AbstractBuilder = require("../AbstractBuilder");
const tasks = { // can't require index.js due to circular dependency
	generateAppPreload: require("../../tasks/bundlers/generateAppPreload"),
	generateFlexChangesBundle: require("../../tasks/bundlers/generateFlexChangesBundle"),
	generateManifestBundle: require("../../tasks/bundlers/generateManifestBundle"),
	generateStandaloneAppBundle: require("../../tasks/bundlers/generateStandaloneAppBundle"),
	createDebugFiles: require("../../tasks/createDebugFiles"),
	generateVersionInfo: require("../../tasks/generateVersionInfo"),
	replaceCopyright: require("../../tasks/replaceCopyright"),
	replaceVersion: require("../../tasks/replaceVersion"),
	uglify: require("../../tasks/uglify")
};

class ApplicationBuilder extends AbstractBuilder {
	/**
	 * Adds tasks for the copyright header and version replacement of the project.
	 */
	preprocess() {
		this.addTask("replaceCopyright", () => {
			const replaceCopyright = tasks.replaceCopyright;
			return replaceCopyright({
				workspace: this.resourceCollections.workspace,
				options: {
					copyright: this.project.metadata.copyright,
					pattern: "/**/*.js"
				}
			});
		});

		this.addTask("replaceVersion", () => {
			const replaceVersion = tasks.replaceVersion;
			return replaceVersion({
				workspace: this.resourceCollections.workspace,
				options: {
					version: this.project.version,
					pattern: "/**/*.js"
				}
			});
		});
	}

	/**
	 * Adds tasks for debug files creation of the project.
	 */
	process() {
		this.addTask("createDebugFiles", () => {
			const createDebugFiles = tasks.createDebugFiles;
			return createDebugFiles({
				workspace: this.resourceCollections.workspace,
				options: {
					pattern: "/**/*.js"
				}
			});
		});
	}

	/**
	 * Adds tasks for the bundling of the project
	 */
	bundle() {
		this.addTask("generateFlexChangesBundle", () => {
			const generateFlexChangesBundle = tasks.generateFlexChangesBundle;
			return generateFlexChangesBundle({
				workspace: this.resourceCollections.workspace,
				options: {
					namespace: this.project.metadata.namespace
				}
			});
		});

		this.addTask("generateManifestBundle", () => {
			const generateManifestBundle = tasks.generateManifestBundle;
			return generateManifestBundle({
				workspace: this.resourceCollections.workspace,
				options: {
					namespace: this.project.metadata.namespace
				}
			});
		});

		if (this.buildOptions.selfContained) {
			this.addTask("generateStandaloneAppBundle", () => {
				const generateStandaloneAppBundle = tasks.generateStandaloneAppBundle;
				return generateStandaloneAppBundle({
					workspace: this.resourceCollections.workspace,
					dependencies: this.resourceCollections.dependencies,
					options: {
						namespace: this.project.metadata.namespace
					}
				});
			});
		} else {
			this.addTask("generateAppPreload", () => {
				const generateAppPreload = tasks.generateAppPreload;
				return generateAppPreload({
					workspace: this.resourceCollections.workspace,
					dependencies: this.resourceCollections.dependencies,
					options: {
						namespace: this.project.metadata.namespace
					}
				});
			});
		}
	}

	/**
	 * Adds tasks for the uglifying and version info generating of the project.
	 */
	optimize() {
		this.addTask("uglify", () => {
			const uglify = tasks.uglify;
			return uglify({
				workspace: this.resourceCollections.workspace,
				options: {
					pattern: "/**/*.js"
				}
			});
		});

		this.addTask("generateVersionInfo", () => {
			const generateVersionInfo = tasks.generateVersionInfo;
			return generateVersionInfo({
				workspace: this.resourceCollections.workspace,
				dependencies: this.resourceCollections.dependencies,
				options: {
					rootProject: this.project,
					pattern: "/**/.library"
				}
			});
		});
	}
}

module.exports = ApplicationBuilder;
