/**
 * Base class for the builder implementation of a project type
 *
 * @abstract
 */
class AbstractBuilder {
	/**
	 * Constructor
	 *
	 * @param {object} project Project configuration
	 * @param {GroupLogger} parentLogger Logger to use
	 */
	constructor({resourceCollections, project, parentLogger, buildOptions}) {
		this.resourceCollections = resourceCollections;
		this.project = project;
		this.buildOptions = buildOptions;
		this.tasks = [];
		this.log = parentLogger.createSubLogger(project.type + " " + project.metadata.name, 0.2);
		this.taskLog = this.log.createTaskLogger("🔨");
	}

	// Build Phases
	preprocess() {}

	themebuilding() {}

	process() {}

	bundle() {}

	optimize() {}

	/**
	 * Adds a executable task to the builder
	 *
	 * The build order depends on the order the build tasks get added to the project.
	 *
	 * @param {string} taskName Name of the task
	 * @param {function} taskFunction
	 */
	addTask(taskName, taskFunction) {
		this.tasks.push({
			taskName: taskName,
			taskFunction: taskFunction
		});
	}

	/**
	 * Takes a list of tasks which should be executed from the available task list of the current builder
	 *
	 * @param {array} tasksToRun List of tasks which should be executed
	 * @returns {Promise} Returns promise chain with tasks
	 */
	build() {
		// Run phases and add tasks to queue
		this.preprocess();
		this.themebuilding();

		if (!this.buildOptions.basic) {
			this.process();
			this.bundle();
			this.optimize();
		}

		const allTasksCount = Object.keys(this.tasks).length;
		this.taskLog.addWork(allTasksCount);

		let taskChain = Promise.resolve();

		for (var i = 0; i < this.tasks.length; i++) {
			var task = this.tasks[i];
			taskChain = taskChain.then(this.wrapTask(task.taskName, task.taskFunction));
		}

		return taskChain;
	}

	/**
	 * Adds progress related functionality to task function.
	 *
	 * @private
	 * @param {string} taskName Name of the task
	 * @param {function} taskFunction Function which executed the task
	 * @returns {function} Wrapped task function
	 */
	wrapTask(taskName, taskFunction) {
		return () => {
			this.taskLog.startWork(`Running task ${taskName}...`);
			return taskFunction().then(() => this.taskLog.completeWork(1));
		};
	}
}

module.exports = AbstractBuilder;
