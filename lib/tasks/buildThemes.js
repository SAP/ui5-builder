import path from "node:path";
import ReaderCollectionPrioritized from "@ui5/fs/ReaderCollectionPrioritized";
import {getLogger} from "@ui5/logger";
const log = getLogger("builder:tasks:buildThemes");
import {fileURLToPath} from "node:url";
import os from "node:os";
import workerpool from "workerpool";
import {createResource} from "@ui5/fs/resourceFactory";

let pool;

function getPool(taskUtil) {
	if (!pool) {
		const MIN_WORKERS = 2;
		const MAX_WORKERS = 4;
		const osCpus = os.cpus().length || 1;
		const maxWorkers = Math.max(Math.min(osCpus - 1, MAX_WORKERS), MIN_WORKERS);

		log.verbose(`Creating workerpool with up to ${maxWorkers} workers (available CPU cores: ${osCpus})`);
		const workerPath = fileURLToPath(new URL("../processors/themeBuilderWorker.js", import.meta.url));
		pool = workerpool.pool(workerPath, {
			workerType: "auto",
			maxWorkers
		});
		taskUtil.registerCleanupTask(() => {
			log.verbose(`Terminating workerpool`);
			const poolToBeTerminated = pool;
			pool = null;
			poolToBeTerminated.terminate();
		});
	}
	return pool;
}

async function buildThemeInWorker(options, taskUtil) {
	return getPool(taskUtil).exec("execThemeBuild", [options]);
}


/**
 * @public
 * @module @ui5/builder/tasks/buildThemes
 */
/**
 * Task to build a library theme.
 *
 * @public
 * @function default
 * @static
 *
 * @param {object} parameters Parameters
 * @param {@ui5/fs/DuplexCollection} parameters.workspace DuplexCollection to read and write files
 * @param {@ui5/fs/AbstractReader} parameters.dependencies Reader or Collection to read dependency files
 * @param {@ui5/builder/tasks/TaskUtil|object} [parameters.taskUtil] TaskUtil instance.
 *    Required when using the <code>useWorkers</code> option
 * @param {object} parameters.options Options
 * @param {string} parameters.options.projectName Project name
 * @param {string} parameters.options.inputPattern Search pattern for *.less files to be built
 * @param {string} [parameters.options.librariesPattern] Search pattern for .library files
 * @param {string} [parameters.options.themesPattern] Search pattern for sap.ui.core theme folders
 * @param {boolean} [parameters.options.compress=true]
 * @param {boolean} [parameters.options.cssVariables=false]
 * @param {boolean} [parameters.options.useWorkers=false]
 * @returns {Promise<undefined>} Promise resolving with <code>undefined</code> once data has been written
 */
export default async function({
	workspace, dependencies, taskUtil,
	options: {
		projectName, inputPattern, librariesPattern, themesPattern, compress, cssVariables, useWorkers = false
	}
}) {
	const combo = new ReaderCollectionPrioritized({
		name: `theme - prioritize workspace over dependencies: ${projectName}`,
		readers: [workspace, dependencies]
	});

	compress = compress === undefined ? true : compress;

	const pThemeResources = workspace.byGlob(inputPattern);
	let pAvailableLibraries;
	let pAvailableThemes;
	if (librariesPattern) {
		// If a librariesPattern is given
		//	we will use it to reduce the set of libraries a theme will be built for
		pAvailableLibraries = combo.byGlob(librariesPattern);
	}
	if (themesPattern) {
		// If a themesPattern is given
		//	we will use it to reduce the set of themes that will be built
		pAvailableThemes = combo.byGlob(themesPattern, {nodir: false});
	}

	/* Don't try to build themes for libraries that are not available
	(maybe replace this with something more aware of which dependencies are optional and therefore
		legitimately missing and which not (fault case))
		*/
	let availableLibraries;
	if (pAvailableLibraries) {
		availableLibraries = [];
		(await pAvailableLibraries).forEach((resource) => {
			const library = path.dirname(resource.getPath());
			if (!availableLibraries.includes(library)) {
				availableLibraries.push(library);
			}
		});
	}
	let availableThemes;
	if (pAvailableThemes) {
		availableThemes = (await pAvailableThemes)
			.filter((resource) => resource.getStatInfo().isDirectory())
			.map((resource) => {
				return path.basename(resource.getPath());
			});
	}

	let themeResources = await pThemeResources;

	const isAvailable = function(resource) {
		let libraryAvailable = false;
		let themeAvailable = false;
		const resourcePath = resource.getPath();
		const themeName = path.basename(path.dirname(resourcePath));

		if (!availableLibraries || availableLibraries.length === 0) {
			libraryAvailable = true; // If no libraries are found, build themes for all libraries
		} else {
			for (let i = availableLibraries.length - 1; i >= 0; i--) {
				if (resourcePath.startsWith(availableLibraries[i])) {
					libraryAvailable = true;
				}
			}
		}

		if (!availableThemes || availableThemes.length === 0) {
			themeAvailable = true; // If no themes are found, build all themes
		} else {
			themeAvailable = availableThemes.includes(themeName);
		}

		if (log.isLevelEnabled("verbose")) {
			if (!libraryAvailable) {
				log.silly(`Skipping ${resourcePath}: Library is not available`);
			}
			if (!themeAvailable) {
				log.verbose(`Skipping ${resourcePath}: sap.ui.core theme '${themeName}' is not available. ` +
				"If you experience missing themes, check whether you have added the corresponding theme " +
				"library to your projects dependencies and make sure that your custom themes contain " +
				"resources for the sap.ui.core namespace.");
			}
		}

		// Only build if library and theme are available
		return libraryAvailable && themeAvailable;
	};

	if (availableLibraries || availableThemes) {
		if (log.isLevelEnabled("verbose")) {
			log.verbose("Filtering themes to be built:");
			if (availableLibraries) {
				log.verbose(`Available libraries: ${availableLibraries.join(", ")}`);
			}
			if (availableThemes) {
				log.verbose(`Available sap.ui.core themes: ${availableThemes.join(", ")}`);
			}
		}
		themeResources = themeResources.filter(isAvailable);
	}

	let buildTheme;
	if (useWorkers) {
		if (!taskUtil) {
			// TaskUtil is required for worker support
			throw new Error(`buildThemes: Option 'useWorkers' requires a taskUtil instance to be provided`);
		}
		buildTheme = buildThemeInWorker;
	} else {
		// Do not use workerpool
		buildTheme = (await import("../processors/themeBuilderWorker.js")).default;
	}

	// All the relevant resources need to be made available for the less parser within the workerpool
	const allResources = await combo.byGlob("/resources/**/{*.less,.theming,img/**,img-RTL/**}");
	const makeTransferableResource = async (resourceCollection) =>
		Promise.all(
			resourceCollection.map(async (res) => ({
				transferable: await res.getBuffer(), // Buffer -> Uint8Array (transferable object)
				path: res.getPath()
			}))
		);
	let allResourcesTransferable;
	if (allResources) {
		allResourcesTransferable = await makeTransferableResource(allResources);
	}

	await Promise.all(themeResources.map(async (themeRes) => {
		const processedResources = await buildTheme({
			allResources: allResourcesTransferable,
			themeResources: await makeTransferableResource([themeRes]),
			options: {
				compress,
				cssVariables: !!cssVariables,
			},
		},
		taskUtil);

		return Promise.all(processedResources.map((res) => {
			return workspace.write(
				// res.transferable is an Uint8Array object and needs to be casted
				// to a Buffer in order to be read correctly.
				createResource({path: res.path, buffer: Buffer.from(res.transferable)}));
		}));
	}));
}
