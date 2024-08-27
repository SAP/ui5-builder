import ReaderCollectionPrioritized from "@ui5/fs/ReaderCollectionPrioritized";
import fsInterface from "@ui5/fs/fsInterface";
import apiIndexGenerator from "../../processors/jsdoc/apiIndexGenerator.js";

/**
 * @module @ui5/builder/tasks/jsdoc/generateApiIndex
 */

/**
 * Compiles an api-index.json resource from all available api.json resources as created by the
 * [executeJsdocSdkTransformation]{@link @ui5/builder/tasks/jsdoc/executeJsdocSdkTransformation} task.
 * The resulting api-index.json resource is mainly to be used in the SDK.
 *
 * @param parameters Parameters
 * @param parameters.workspace DuplexCollection to read and write files
 * @param parameters.dependencies Reader or Collection to read dependency files
 * @param parameters.options Options
 * @param parameters.options.projectName Project name
 * @returns Promise resolving with <code>undefined</code> once data has been written
 */
export default async function ({workspace, dependencies, options: {projectName}}: object) {
	const combo = new ReaderCollectionPrioritized({
		name: `generateApiIndex - workspace + dependencies: ${projectName}`,
		readers: [workspace, dependencies],
	});

	const versionInfoPath = "/resources/sap-ui-version.json";
	const testResourcesRootPath = "/test-resources";
	const targetApiIndexPath = "/docs/api/api-index.json";
	const targetApiIndexDeprecatedPath = "/docs/api/api-index-deprecated.json";
	const targetApiIndexExperimentalPath = "/docs/api/api-index-experimental.json";
	const targetApiIndexSincePath = "/docs/api/api-index-since.json";

	const createdResources = await apiIndexGenerator({
		versionInfoPath,
		testResourcesRootPath,
		targetApiIndexPath,
		targetApiIndexDeprecatedPath,
		targetApiIndexExperimentalPath,
		targetApiIndexSincePath,
		fs: fsInterface(combo),
	});

	await Promise.all(createdResources.map((resource) => {
		return workspace.write(resource);
	}));
}
