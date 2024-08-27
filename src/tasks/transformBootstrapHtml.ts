import {getLogger} from "@ui5/logger";
const log = getLogger("builder:tasks:transformBootstrapHtml");
import bootstrapHtmlTransformer from "../processors/bootstrapHtmlTransformer.js";

/* eslint "jsdoc/check-param-names": ["error", {"disableExtraPropertyReporting":true}] */
/**
 * Task for transforming the application bootstrap HTML file.
 *
 * @param parameters Parameters
 * @param parameters.workspace DuplexCollection to read and write files
 * @param parameters.options Options
 * @param parameters.options.projectName Project name
 * @param [parameters.options.projectNamespace] Project namespace
 * @returns Promise resolving with <code>undefined</code> once data has been written
 */
export default async function ({workspace, options}: object) {
	const {projectName} = options;
	const namespace = options.projectNamespace;

	let indexPath;
	if (namespace) {
		indexPath = `/resources/${namespace}/index.html`;
	} else {
		indexPath = "/index.html";
	}
	const resource = await workspace.byPath(indexPath);
	if (!resource) {
		log.warn(`Skipping bootstrap transformation due to missing index.html in project "${projectName}".`);
		return;
	}
	const processedResources = await bootstrapHtmlTransformer({
		resources: [resource],
		options: {
			src: "resources/sap-ui-custom.js",
		},
	});
	await Promise.all(processedResources.map((resource) => workspace.write(resource)));
}
