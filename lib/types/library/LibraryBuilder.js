const AbstractBuilder = require("../AbstractBuilder");
const tasks = { // can't require index.js due to circular dependency
	generateLibraryPreload: require("../../tasks/bundlers/generateLibraryPreload"),
	buildThemes: require("../../tasks/buildThemes"),
	createDebugFiles: require("../../tasks/createDebugFiles"),
	replaceCopyright: require("../../tasks/replaceCopyright"),
	replaceVersion: require("../../tasks/replaceVersion"),
	uglify: require("../../tasks/uglify")
};

class LibraryBuilder extends AbstractBuilder {
	preprocess() {
		this.addTask("replaceCopyright", () => {
			const replaceCopyright = tasks.replaceCopyright;
			return replaceCopyright({
				workspace: this.resourceCollections.workspace,
				options: {
					copyright: this.project.metadata.copyright,
					pattern: "/resources/**/*.js"
				}
			});
		});

		this.addTask("replaceVersion", () => {
			const replaceVersion = tasks.replaceVersion;
			return replaceVersion({
				workspace: this.resourceCollections.workspace,
				options: {
					version: this.project.version,
					pattern: "/resources/**/*.js"
				}
			});
		});
	}

	themebuilding() {
		this.addTask("buildThemes", () => {
			const buildThemes = tasks.buildThemes;
			return buildThemes({
				workspace: this.resourceCollections.workspace,
				dependencies: this.resourceCollections.dependencies,
				options: {
					projectName: this.project.metadata.name,
					librariesPattern: "/resources/**/*.library",
					inputPattern: "/resources/**/themes/*/library.source.less"
				}
			});
		});
	}

	process() {
		this.addTask("createDebugFiles", () => {
			const createDebugFiles = tasks.createDebugFiles;
			return createDebugFiles({
				workspace: this.resourceCollections.workspace,
				options: {
					pattern: "/resources/**/*.js"
				}
			});
		});
	}

	bundle() {
		this.addTask("generateLibraryPreload", () => {
			const generateLibraryPreload = tasks.generateLibraryPreload;
			return generateLibraryPreload({
				workspace: this.resourceCollections.workspace,
				dependencies: this.resourceCollections.dependencies,
				options: {
					projectName: this.project.metadata.name
				}
			});
		});
	}

	optimize() {
		this.addTask("uglify", () => {
			const uglify = tasks.uglify;
			return uglify({
				workspace: this.resourceCollections.workspace,
				options: {
					pattern: "/resources/**/*.js"
				}
			});
		});
	}
}

module.exports = LibraryBuilder;
