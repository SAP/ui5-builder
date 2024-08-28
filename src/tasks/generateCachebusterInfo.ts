import crypto from "node:crypto";
import {createResource} from "@ui5/fs/resourceFactory";
import {getLogger} from "@ui5/logger";
const log = getLogger("builder:tasks:generateCachebusterInfo");

/**
 * @module @ui5/builder/tasks/generateCachebusterInfo
 */

/**
 *
 * @param resource
 */
async function signByTime(resource) {
	return resource.getStatInfo().mtime.getTime();
}

/**
 *
 * @param resource
 */
async function signByHash(resource) {
	const hasher = crypto.createHash("sha1");
	const buffer = await resource.getBuffer();

	hasher.update(buffer.toString("binary"));
	return hasher.digest("hex");
}

/**
 *
 * @param type
 */
function getSigner(type) {
	type = type || "time";

	switch (type) {
		case "time":
			return signByTime;
		case "hash":
			return signByHash;

		default:
			throw new Error(`Invalid signature type: '${type}'. Valid ones are: 'time' or 'hash'`);
	}
}

/* eslint "jsdoc/check-param-names": ["error", {"disableExtraPropertyReporting":true}] */
/**
 * Task to generate the application cachebuster info file.
 *
 * @param parameters Parameters
 * @param parameters.workspace DuplexCollection to read and write files
 * @param parameters.options Options
 * @param parameters.options.projectNamespace Namespace of the application
 * @param [parameters.options.signatureType] Type of signature to be used ('time' or 'hash')
 * @returns Promise resolving with <code>undefined</code> once data has been written
 */
export default function ({workspace, options}: object) {
	const {signatureType} = options;
	const namespace = options.projectNamespace;

	const basePath = `/resources/${namespace}/`;
	return workspace.byGlob(`/resources/${namespace}/**/*`)
		.then(async (resources) => {
			const cachebusterInfo = Object.create(null);
			const signer = getSigner(signatureType);

			await Promise.all(resources.map(async (resource) => {
				let resourcePath = resource.getPath();
				if (!resourcePath.startsWith(basePath)) {
					log.verbose(
						`Ignoring resource with path ${resourcePath} since it is not based on path ${basePath}`);
					return;
				}
				// Remove base path. Absolute paths are not allowed in cachebuster info
				resourcePath = resourcePath.replace(basePath, "");
				cachebusterInfo[resourcePath] = await signer(resource);
			}));
			const cachebusterInfoResource = createResource({
				path: `/resources/${namespace}/sap-ui-cachebuster-info.json`,
				string: JSON.stringify(cachebusterInfo, null, 2),
			});
			return workspace.write(cachebusterInfoResource);
		});
}
