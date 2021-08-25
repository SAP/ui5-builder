
/**
 * Resource collections
 *
 * @public
 * @typedef module:@ui5/builder.BuilderResourceCollections
 * @property {module:@ui5/fs.DuplexCollection} workspace Workspace Resource
 * @property {module:@ui5/fs.ReaderCollection} dependencies Workspace Resource
 */

/**
 * Base class for the builder implementation of a project type
 *
 * @abstract
 */
class AbstractBuilder {
	/**
	 * Constructor
	 *
	 * @param {object} parameters
	 * @param {BuilderResourceCollections} parameters.resourceCollections Resource collections
	 * @param {object} parameters.project Project configuration
	 * @param {GroupLogger} parameters.parentLogger Logger to use
	 * @param {object} parameters.taskUtil
	 */
	constructor({resourceCollections, project, parentLogger, taskUtil}) {
		if (new.target === AbstractBuilder) {
			throw new TypeError("Class 'AbstractBuilder' is abstract");
		}

		this.project = project;

		this.log = parentLogger.createSubLogger(project.type + " " + project.metadata.name, 0.2);
		this.taskLog = this.log.createTaskLogger("🔨");

		this.tasks = {};
		this.taskExecutions = {};
		this.taskExecutionOrder = [];
		this.addStandardTasks({
			resourceCollections,
			project,
			log: this.log,
			taskUtil
		});
		this.addCustomTasks({
			resourceCollections,
			project,
			taskUtil
		});
	}

	/**
	 * Adds all standard tasks to execute
	 *
	 * @abstract
	 * @protected
	 * @param {object} parameters
	 * @param {BuilderResourceCollections} parameters.resourceCollections Resource collections
	 * @param {object} parameters.taskUtil
	 * @param {object} parameters.project Project configuration
	 * @param {object} parameters.log <code>@ui5/logger</code> logger instance
	 */
	addStandardTasks({resourceCollections, project, log, taskUtil}) {
		throw new Error("Function 'addStandardTasks' is not implemented");
	}

	/**
	 * Adds custom tasks to execute
	 *
	 * @private
	 * @param {object} parameters
	 * @param {BuilderResourceCollections} parameters.resourceCollections Resource collections
	 * @param {object} parameters.taskUtil
	 * @param {object} parameters.project Project configuration
	 */
	addCustomTasks({resourceCollections, project, taskUtil}) {
		const projectCustomTasks = project.builder && project.builder.customTasks;
		if (!projectCustomTasks || projectCustomTasks.length === 0) {
			return; // No custom tasks defined
		}
		const taskRepository = require("../tasks/taskRepository");
		for (let i = 0; i < projectCustomTasks.length; i++) {
			const taskDef = projectCustomTasks[i];
			if (!taskDef.name) {
				throw new Error(`Missing name for custom task definition of project ${project.metadata.name} ` +
					`at index ${i}`);
			}
			if (taskDef.beforeTask && taskDef.afterTask) {
				throw new Error(`Custom task definition ${taskDef.id || taskDef.name} of project ` +
					`${project.metadata.name} defines both "beforeTask" and "afterTask" parameters. ` +
					`Only one must be defined.`);
			}
			if (this.taskExecutionOrder.length && !taskDef.beforeTask && !taskDef.afterTask) {
				// If there are tasks configured, beforeTask or afterTask must be given
				throw new Error(`Custom task definition ${taskDef.id || taskDef.name} of project ` +
					`${project.metadata.name} defines neither a "beforeTask" nor an "afterTask" parameter. ` +
					`One must be defined.`);
			}

			let taskId = taskDef.id;
			if (!taskId) {
				// No identifier defined, use the task name and add a suffix if necessary
				taskId = taskDef.name;
				if (this.tasks[taskId]) {
					// Task is already known => add a suffix to allow for multiple configurations of the same task
					let suffixCounter = 0;
					while (this.tasks[taskId]) {
						suffixCounter++; // Start at 1
						taskId = `${taskDef.name}--${suffixCounter}`;
					}
				}
			} else if (this.tasks[taskId]) {
				throw new Error(`Conflicting custom task definition ${taskId} of project ${project.metadata.name}, ` +
					`more than one task with the same identifier defined. Task identifiers must be unique.`);
			}

			// Create custom task if not already done (task might be referenced multiple times, first one wins)
			const {specVersion, task} = taskRepository.getTask(taskDef.name);
			const execTask = function() {
				/* Custom Task Interface
					Parameters:
						{Object} parameters Parameters
						{module:@ui5/fs.DuplexCollection} parameters.workspace DuplexCollection to read and write files
						{module:@ui5/fs.AbstractReader} parameters.dependencies
							Reader or Collection to read dependency files
						{Object} parameters.taskUtil Specification Version dependent interface to a
							[TaskUtil]{@link module:@ui5/builder.tasks.TaskUtil} instance
						{Object} parameters.options Options
						{string} parameters.options.projectName Project name
						{string} [parameters.options.projectNamespace] Project namespace if available
						{string} [parameters.options.configuration] Task configuration if given in ui5.yaml
					Returns:
						{Promise<undefined>} Promise resolving with undefined once data has been written
				*/
				const params = {
					workspace: resourceCollections.workspace,
					dependencies: resourceCollections.dependencies,
					options: {
						projectName: project.metadata.name,
						projectNamespace: project.metadata.namespace,
						configuration: taskDef.configuration
					}
				};

				const taskUtilInterface = taskUtil.getInterface(specVersion);
				// Interface is undefined if specVersion does not support taskUtil
				if (taskUtilInterface) {
					params.taskUtil = taskUtilInterface;
				}
				return task(params);
			};

			this.tasks[taskId] = execTask;

			(this.taskExecutions[taskDef.name] || (this.taskExecutions[taskDef.name] = [])).push(taskId);
			if (this.taskExecutionOrder.length) {
				// There is at least one task configured. Use before- and afterTask to add the custom task
				const refTaskId = taskDef.beforeTask || taskDef.afterTask;
				let refTaskIdx = this.taskExecutionOrder.indexOf(refTaskId);
				if (refTaskIdx === -1) {
					throw new Error(`Could not find task ${refTaskId}, referenced by custom task ${taskId}, ` +
						`to be scheduled for project ${project.metadata.name}`);
				}
				if (taskDef.afterTask) {
					// Insert after index of referenced task
					refTaskIdx++;
				}
				this.taskExecutionOrder.splice(refTaskIdx, 0, taskId);
			} else {
				// There is no task configured so far. Just add the custom task
				this.taskExecutionOrder.push(taskId);
			}
		}
	}

	/**
	 * Adds a executable task to the builder
	 *
	 * The order this function is being called defines the build order. FIFO.
	 *
	 * @param {string} [taskId] Identifier of the task which should be in the list availableTasks.
	 * @param {string} taskName Name of the task which should be in the list availableTasks.
	 * @param {Function} taskFunction
	 */
	addTask(taskId, taskName, taskFunction) {
		if (typeof taskName === "function") {
			taskFunction = taskName;
			taskName = taskId;
		}

		if (this.tasks[taskId]) {
			throw new Error(`Failed to add duplicate task ${taskId} for project ${this.project.metadata.name}`);
		}
		if (this.taskExecutionOrder.includes(taskId)) {
			throw new Error(`Builder: Failed to add task ${taskId} for project ${this.project.metadata.name}. ` +
				`It has already been scheduled for execution.`);
		}

		this.tasks[taskId] = taskFunction;
		(this.taskExecutions[taskName] || (this.taskExecutions[taskName] = [])).push(taskId);
		this.taskExecutionOrder.push(taskId);
	}

	/**
	 * Check whether a task is defined
	 *
	 * @private
	 * @param {string} taskId
	 * @returns {boolean}
	 */
	hasTask(taskId) {
		return Object.prototype.hasOwnProperty.call(this.tasks, taskId);
	}

	/**
	 * Takes a list of tasks which should be executed from the available task list of the current builder
	 *
	 * @param {Array} tasksToRun List of tasks names which should be executed
	 * @returns {Promise} Returns promise chain with tasks
	 */
	build(tasksToRun) {
		const taskIdsToRun = tasksToRun.reduce((tasks, taskName) => {
			if (this.taskExecutions[taskName]) {
				tasks.push(...this.taskExecutions[taskName]);
			}

			return tasks;
		}, []);

		const allTasks = this.taskExecutionOrder.filter((taskId) =>
			this.hasTask(taskId) && taskIdsToRun.includes(taskId));
		this.taskLog.addWork(allTasks.length);

		return allTasks.reduce((taskChain, taskId) => {
			const taskFunction = this.tasks[taskId];

			if (typeof taskFunction === "function") {
				taskChain = taskChain.then(this.wrapTask(taskId, taskFunction));
			}

			return taskChain;
		}, Promise.resolve());
	}

	/**
	 * Adds progress related functionality to task function.
	 *
	 * @private
	 * @param {string} taskId Name of the task
	 * @param {Function} taskFunction Function which executed the task
	 * @returns {Function} Wrapped task function
	 */
	wrapTask(taskId, taskFunction) {
		return () => {
			this.taskLog.startWork(`Running task ${taskId}...`);
			return taskFunction().then(() => this.taskLog.completeWork(1));
		};
	}
}

module.exports = AbstractBuilder;
