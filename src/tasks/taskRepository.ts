import {createRequire} from "node:module";

// TODO TS: this is a copy from @ui5/project TaskRunner.ts
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TaskFunction = ({dependencies, options, taskUtil, workspace}: any) => Promise<void>;

/**
 * Repository providing access to all UI5 Builder tasks and various metadata required by the build process.
 * This module is designed to be imported by @ui5/project or to be passed as a private parameter
 * to the <code>build</code> function of a [@ui5/project/graph/ProjectGraph]{@link @ui5/project/graph/ProjectGraph}.
 *
 * For other use cases, it is recommended to import the required tasks directly.
 *
 * Therefore, all API of this module is private.
 *
 * @module @ui5/builder/tasks/taskRepository
 */

type TaskInfo = Record<string, {path: string}>;

const taskInfos: TaskInfo = {
	replaceCopyright: {path: "./replaceCopyright.js"},
	replaceVersion: {path: "./replaceVersion.js"},
	replaceBuildtime: {path: "./replaceBuildtime.js"},
	enhanceManifest: {path: "./enhanceManifest.js"},
	escapeNonAsciiCharacters: {path: "./escapeNonAsciiCharacters.js"},
	executeJsdocSdkTransformation: {path: "./jsdoc/executeJsdocSdkTransformation.js"},
	generateApiIndex: {path: "./jsdoc/generateApiIndex.js"},
	generateJsdoc: {path: "./jsdoc/generateJsdoc.js"},
	minify: {path: "./minify.js"},
	buildThemes: {path: "./buildThemes.js"},
	transformBootstrapHtml: {path: "./transformBootstrapHtml.js"},
	generateLibraryManifest: {path: "./generateLibraryManifest.js"},
	generateVersionInfo: {path: "./generateVersionInfo.js"},
	generateFlexChangesBundle: {path: "./bundlers/generateFlexChangesBundle.js"},
	generateComponentPreload: {path: "./bundlers/generateComponentPreload.js"},
	generateResourcesJson: {path: "./generateResourcesJson.js"},
	generateThemeDesignerResources: {path: "./generateThemeDesignerResources.js"},
	generateStandaloneAppBundle: {path: "./bundlers/generateStandaloneAppBundle.js"},
	generateBundle: {path: "./bundlers/generateBundle.js"},
	generateLibraryPreload: {path: "./bundlers/generateLibraryPreload.js"},
	generateCachebusterInfo: {path: "./generateCachebusterInfo.js"},
};

/**
 * Returns the module for a given task name
 *
 * @param taskName Name of the task to retrieve
 * @throws {Error} In case the specified task does not exist
 * @returns Object containing the task module
 */
export async function getTask(taskName: string): Promise<{task: TaskFunction}> {
	const taskInfo = taskInfos[taskName];

	if (!taskInfo) {
		if (getRemovedTaskNames().includes(taskName)) {
			throw new Error(
				`Standard task ${taskName} has been removed in UI5 Tooling 3.0. ` +
				`Please see the migration guide at https://sap.github.io/ui5-tooling/updates/migrate-v3/`);
		}
		throw new Error(`taskRepository: Unknown Task ${taskName}`);
	}
	try {
		const {default: task} = await import(taskInfo.path) as {default: TaskFunction};
		return {
			task,
		};
	} catch (err) {
		if (err instanceof Error) {
			throw new Error(`taskRepository: Failed to require task module for ${taskName}: ${err.message}`);
		}
		throw err;
	}
}

/**
 * Returns a list of the names of all available tasks
 *
 * @returns Array containing the names of all available tasks
 */
export function getAllTaskNames() {
	return Object.keys(taskInfos);
}

/**
 * Returns a list of the names of all tasks that have been removed
 * in this or previous versions of ui5-builder.
 *
 * @returns Array containing the names of all removed tasks
 */
export function getRemovedTaskNames() {
	return ["createDebugFiles", "uglify", "generateManifestBundle"];
}

// Using CommonsJS require since JSON module imports are still experimental
const require = createRequire(import.meta.url);
/**
 *
 * @param pkg
 */
function getVersion(pkg) {
	return require(`${pkg}/package.json`).version;
}

/**
 * Object containing the versions of the ui5-builder module and relevant dependencies
 *
 * builderVersion Version of the ui5-builder module
 *
 * fsVersion Version of the ui5-fs module in use
 */

/**
 * Provides version information on all relevant modules, used by ui5-builder
 *
 * @returns Object containing version information
 */
export async function getVersions() {
	return {
		builderVersion: getVersion("@ui5/builder"),
		fsVersion: getVersion("@ui5/fs"),
	};
}
