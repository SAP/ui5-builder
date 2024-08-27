import {getLogger} from "@ui5/logger";
const log = getLogger("builder:processors:themeBuilder");
import posixPath from "node:path/posix";
import less from "less-openui5";
import Resource from "@ui5/fs/Resource";

const libraryMatchPattern = /^\/resources\/(.*)\/themes\/[^/]*\/library\.source\.less$/i;

/**
 * @module @ui5/builder/processors/ThemeBuilder
 */

/**
 * Builds a library theme
 *
 */
export class ThemeBuilder {
	/**
	 * Constructor
	 *
	 * @param fs.fs
	 * @param fs Node fs or custom
	 * 		[fs interface]{@link module:@ui5/fs/fsInterface}
	 */
	constructor({fs}: fs | module) {
		this.builder = new less.Builder({fs});
	}

	/**
	 * Starts the theme build
	 *
	 * @param resources Library files
	 * @param [options] Build options
	 * @param [options.compress] Compress build output (CSS / JSON)
	 * @param [options.cssVariables] Generates the CSS variables
	 *   (css-variables.css, css-variables.source.less) and the skeleton for a theme
	 *   (library-skeleton.css, [library-skeleton-RTL.css])
	 * @returns Resolving with array of created files
	 */
	public build(resources, {compress = false, cssVariables = false}: {
		compress?: boolean;
		cssVariables?: boolean;
	} = {}) {
		const files = [];

		const compile = (resource) => {
			log.verbose(`Compiling ${resource.getPath()}`);

			let libraryName;
			const libraryMatch = libraryMatchPattern.exec(resource.getPath());
			if (libraryMatch) {
				libraryName = libraryMatch[1].replace(/\//g, ".");
			}

			return this.builder.build({
				lessInputPath: resource.getPath(),
				library: {
					name: libraryName,
				},
				compiler: {
					compress,
				},
				cssVariables,
			}).then((result) => {
				const themeDir = posixPath.dirname(resource.getPath());

				const libCss = new Resource({
					path: themeDir + "/library.css",
					string: result.css,
				});

				const libCssRtl = new Resource({
					path: themeDir + "/library-RTL.css",
					string: result.cssRtl,
				});

				const libParams = new Resource({
					path: themeDir + "/library-parameters.json",
					string: JSON.stringify(result.variables, null, compress ? null : "\t"),
				});

				files.push(libCss, libCssRtl, libParams);

				if (cssVariables) {
					const libCssVarsSource = new Resource({
						path: themeDir + "/css_variables.source.less",
						string: result.cssVariablesSource,
					});
					const libCssVars = new Resource({
						path: themeDir + "/css_variables.css",
						string: result.cssVariables,
					});
					const libCssSkel = new Resource({
						path: themeDir + "/library_skeleton.css",
						string: result.cssSkeleton,
					});
					const libCssSkelRtl = new Resource({
						path: themeDir + "/library_skeleton-RTL.css",
						string: result.cssSkeletonRtl,
					});

					files.push(libCssVarsSource, libCssVars, libCssSkel, libCssSkelRtl);
				}
			}, (err) => {
				log.error(`Error while compiling ${resource.getPath()}: ${err.message}`);
				throw err;
			});
		};

		return Promise.all(resources.map(compile)).then(() => {
			return files;
		});
	}

	/**
	 * Clears all cached build results.
	 *
	 * Use this method to prevent high memory consumption when building many themes within the same process.
	 *
	 */
	public clearCache() {
		this.builder.clearCache();
	}
}

/**
 *
 *[compress=false] Compress build output (CSS / JSON)
 *
 * [cssVariables=false] Generates the CSS variables
 * (css-variables.css, css-variables.source.less) and the skeleton for a theme
 * (library-skeleton.css, [library-skeleton-RTL.css])
 */

/**
 * Builds a library theme.
 *
 * @alias @ui5/builder/processors/themeBuilder
 * @param parameters Parameters
 * @param parameters.resources List of <code>library.source.less</code>
 *   resources to be processed
 * @param parameters.fs Node fs or custom
 *   [fs interface]{@link module:@ui5/fs/fsInterface}
 * @param [parameters.options] Options
 * @returns Promise resolving with theme resources
 */
export default async function ({resources, fs, options = {}}: object) {
	const {compress, cssVariables} = (options);
	const themeBuilder = new ThemeBuilder({fs});
	return themeBuilder.build(resources, {
		compress,
		cssVariables,
	}).then((files) => {
		themeBuilder.clearCache();
		return files;
	});
}
