const log = require("@ui5/logger").getGroupLogger("builder:builder");
const resourceFactory = require("@ui5/fs").resourceFactory;
const typeRepository = require("../types/typeRepository");

const definedTasks = {
	replaceCopyright: require("../tasks/replaceCopyright"),
	replaceVersion: require("../tasks/replaceVersion"),
	createDebugFiles: require("../tasks/createDebugFiles"),
	uglify: require("../tasks/uglify"),
	buildThemes: require("../tasks/buildThemes"),
	generateVersionInfo: require("../tasks/generateVersionInfo"),
	generateManifestBundle: require("../tasks/bundlers/generateManifestBundle"),
	generateFlexChangesBundle: require("../tasks/bundlers/generateFlexChangesBundle"),
	generateAppPreload: require("../tasks/bundlers/generateAppPreload"),
	generateStandaloneAppBundle: require("../tasks/bundlers/generateStandaloneAppBundle"),
	generateLibraryPreload: require("../tasks/bundlers/generateLibraryPreload")
};

/**
 * Calculates the elapsed build time and returns a prettified output
 *
 * @private
 * @param {Array} startTime Array provided by <code>process.hrtime()</code>
 * @returns {string} Difference between now and the provided time array as formatted string
 */
function getElapsedTime(startTime) {
	const prettyHrtime = require("pretty-hrtime");
	const timeDiff = process.hrtime(startTime);
	return prettyHrtime(timeDiff);
}

/**
 * The UI5 Builder.
 *
 * @module builder/builder
 */

/**
 * Configures the project build and starts it.
 *
 * @param {Object} parameters Parameters
 * @param {Object} parameters.tree Dependency tree
 * @param {string} parameters.destPath Target path
 * @param {boolean} [parameters.buildDependencies=false] Decides whether project dependencies are built as well
 * @param {boolean} [parameters.basic=false] Decides whether a basic build should be activated (skips non-essential and time-intensive tasks)
 * @param {boolean} [parameters.selfContained=false] Flag to activate self contained build
 * @param {Array} [parameters.includedTasks=[]] List of tasks to be included
 * @param {Array} [parameters.excludedTasks=[]] List of tasks to be excluced. If the wildcard '*' is provided, only the included tasks will be executed.
 * @param {Array} [parameters.devExcludeProject=[]] List of projects to be exlcuded from basic build
 * @returns {Promise<undefined>} Promise resolving to <code>undefined</code> once build has finished
 */
function build({tree, destPath, buildDependencies = false, basic = false, selfContained = false, includedTasks = [], excludedTasks = [], devExcludeProject = []}) {
	const startTime = process.hrtime();
	log.info(`Building project ${tree.metadata.name}` + (buildDependencies ? "" : " not") +
		" including dependencies..." + (basic ? " [basic mode]" : ""));
	log.verbose(`Building to ${destPath}...`);

	const fsTarget = resourceFactory.createAdapter({
		fsBasePath: destPath,
		virBasePath: "/"
	});

	// If both build options are set to true, only the basic build mode will be activated
	if (basic && selfContained) {
		log.info("Building project in basic mode.");
		selfContained = false;
	}

	const projects = {}; // Unique project index to prevent building the same project multiple times
	const projectCountMarker = {};
	function projectCount(project, count = 0) {
		if (buildDependencies) {
			count = project.dependencies.reduce((depCount, depProject) => {
				return projectCount(depProject, depCount);
			}, count);
		}
		if (!projectCountMarker[project.metadata.name]) {
			count++;
			projectCountMarker[project.metadata.name] = true;
		}
		return count;
	}
	const iProjectCount = projectCount(tree);
	const buildLogger = log.createTaskLogger("🛠 ", iProjectCount);

	function buildProject(project) {
		let depPromise;
		if (buildDependencies) {
			// Build dependencies in sequence as it is far easier to detect issues and reduces
			// side effects or other issues such as too many open files
			depPromise = project.dependencies.reduce(function(p, depProject) {
				return p.then(() => buildProject(depProject));
			}, Promise.resolve());
		} else {
			depPromise = Promise.resolve();
		}
		// Build the project after all dependencies have been built
		return depPromise.then(() => {
			if (projects[project.metadata.name]) {
				return Promise.resolve();
			} else {
				projects[project.metadata.name] = true;
			}
			buildLogger.startWork(`Building project ${project.metadata.name}`);

			const projectType = typeRepository.getType(project.type);
			const resourceCollections = resourceFactory.createCollectionsForTree(project, {
				useNamespaces: true
			});

			const workspace = resourceFactory.createWorkspace({
				reader: resourceCollections.source,
				name: project.metadata.name
			});

			return projectType.build({
				resourceCollections: {
					workspace,
					dependencies: resourceCollections.dependencies
				},
				project,
				parentLogger: log,
				buildOptions: {
					basic: basic,
					selfContained: selfContained
				}
			}).then(() => {
				log.verbose("Finished building project %s. Writing out files...", project.metadata.name);
				buildLogger.completeWork(1);

				return workspace.byGlob("/**/*.*").then((resources) => {
					return Promise.all(resources.map((resource) => {
						if (project === tree && project.metadata.namespace) {
							// Root-project only: Remove namespace prefix if given
							resource.setPath(resource.getPath().replace(
								new RegExp(`^/resources/${project.metadata.namespace}`), ""));
						}
						return fsTarget.write(resource);
					}));
				});
			});
		});
	}

	return buildProject(tree).then(() => {
		log.info(`Build succeeded in ${getElapsedTime(startTime)}`);
	}, (err) => {
		log.error(`Build failed in ${getElapsedTime(startTime)}`);
		throw err;
	});
}

module.exports = {
	build: build,
	tasks: definedTasks
};
