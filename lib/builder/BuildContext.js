const ResourceTagCollection = require("@ui5/fs").ResourceTagCollection;
const ProjectBuildContext = require("./ProjectBuildContext");

const GLOBAL_TAGS = Object.freeze({
	IsDebugVariant: "ui5:IsDebugVariant",
	HasDebugVariant: "ui5:HasDebugVariant",
});

/**
 * Context of a build process
 *
 * @private
 * @memberof module:@ui5/builder.builder
 */
class BuildContext {
	constructor({rootProject}) {
		if (!rootProject) {
			throw new Error(`Missing parameter 'rootProject'`);
		}
		this.rootProject = rootProject;
		this.projectBuildContexts = [];

		this._resourceTagCollection = new ResourceTagCollection({
			allowedTags: Object.values(GLOBAL_TAGS)
		});
	}

	getRootProject() {
		return this.rootProject;
	}

	createProjectContext({project, resources}) {
		const projectBuildContext = new ProjectBuildContext({
			buildContext: this,
			project,
			resources
		});
		this.projectBuildContexts.push(projectBuildContext);
		return projectBuildContext;
	}

	async executeCleanupTasks() {
		await Promise.all(this.projectBuildContexts.map((ctx) => {
			return ctx.executeCleanupTasks();
		}));
	}

	getResourceTagCollection() {
		return this._resourceTagCollection;
	}
}

module.exports = BuildContext;
