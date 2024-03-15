import semver from "semver";
const {SemVer: Version, lt} = semver;
import {promisify} from "node:util";
import path from "node:path/posix";
import {getLogger} from "@ui5/logger";
const log = getLogger("builder:processors:manifestEnricher");

const APP_DESCRIPTOR_V22 = new Version("1.21.0");

function isAbsoluteUrl(url) {
	if (url.startsWith("/")) {
		return true;
	}
	try {
		const parsedUrl = new URL(url);
		// URL with ui5 protocol shouldn't be treated as absolute URL and will be handled separately
		return parsedUrl.protocol !== "ui5:";
	} catch (err) {
		// URL constructor without base requires absolute URL and throws an error for relative URLs
		return false;
	}
}

/**
 * Returns a bundle URL from the given bundle name, relative to the given namespace.
 *
 * @param {string} bundleName Bundle name (e.g. "sap.ui.demo.app.i18n.i18n") to be resolved to a relative URL
 * @param {string} sapAppId Project namespace from sap.app/id (e.g. "sap.ui.demo.app")
 *                          to which a bundleName should be resolved to
 * @returns {string} Relative bundle URL (e.g. "i18n/i18n.properties")
 */
function getRelativeBundleUrlFromName(bundleName, sapAppId) {
	const bundleUrl = "/resources/" + bundleName.replace(/\./g, "/") + ".properties";
	return normalizeBundleUrl(bundleUrl, sapAppId);
}

// Copied from sap/base/util/LoaderExtensions.resolveUI5Url
// Adjusted to not resolve the URL, but create an absolute path prefixed with /resources
function resolveUI5Url(sUrl) {
	// check for ui5 scheme
	if (sUrl.startsWith("ui5:")) {
		let sNoScheme = sUrl.replace("ui5:", "");

		// check for authority
		if (!sNoScheme.startsWith("//")) {
			// URLs using the 'ui5' protocol must be absolute.
			// Relative and server absolute URLs are reserved for future use.
			return null;
		}

		sNoScheme = sNoScheme.replace("//", "");

		return "/resources/" + sNoScheme;
	} else {
		// not a ui5 url
		return sUrl;
	}
}

/**
 * Normalizes a bundle URL relative to the project namespace.
 *
 * @param {string} bundleUrl Relative bundle URL to be normalized
 * @param {string} sapAppId Project namespace from sap.app/id (e.g. "sap.ui.demo.app")
 *                          to which the URL is relative to
 * @returns {string} Normalized relative bundle URL (e.g. "i18n/i18n.properties")
 */
function normalizeBundleUrl(bundleUrl, sapAppId) {
	// Create absolute path with namespace from sap.app/id
	const absoluteNamespace = `/resources/${sapAppId.replaceAll(/\./g, "/")}`;

	const resolvedAbsolutePath = path.resolve(absoluteNamespace, bundleUrl);
	const resolvedRelativePath = path.relative(absoluteNamespace, resolvedAbsolutePath);
	return resolvedRelativePath;
}

/**
 * Returns the bundle URL from the given bundle configuration.
 *
 * @param {object} bundleConfig Bundle configuration
 * @param {string} sapAppId Project namespace from sap.app/id (e.g. "sap.ui.demo.app")
 *                          to which a bundleName should be resolved to
 * @param {string} [defaultBundleUrl] Default bundle url in case bundleConfig is not defined
 */
function getBundleUrlFromConfig(bundleConfig, sapAppId, defaultBundleUrl) {
	if (!bundleConfig) {
		// Use default URL (or undefined if argument is not provided)
		return defaultBundleUrl;
	} else if (typeof bundleConfig === "string") {
		return bundleConfig;
	} else if (typeof bundleConfig === "object") {
		return getBundleUrlFromConfigObject(bundleConfig, sapAppId);
	}
}

// Same as above, but does only accept objects, not strings or defaults
function getBundleUrlFromConfigObject(bundleConfig, sapAppId) {
	if (typeof bundleConfig === "object") {
		if (bundleConfig.bundleName) {
			return getRelativeBundleUrlFromName(bundleConfig.bundleName, sapAppId);
		} else if (bundleConfig.bundleUrl) {
			return bundleConfig.bundleUrl;
		}
	}
}

// See runtime logic in sap/ui/core/Lib#_normalizeI18nSettings
function getBundleUrlFromSapUi5LibraryI18n(vI18n) {
	if (vI18n == null || vI18n === true) {
		return "messagebundle.properties";
	} else if (typeof vI18n === "string") {
		return vI18n;
	} else if (typeof vI18n === "object") {
		return vI18n.bundleUrl;
	} else {
		return null;
	}
}

class ManifestEnricher {
	/**
	 * @param {string} manifest manifest.json content
	 * @param {string} filePath manifest.json file path
	 * @param {fs} fs Node fs or custom [fs interface]{@link module:@ui5/fs/fsInterface}
	 */
	constructor(manifest, filePath, fs) {
		this.fsReadDir = promisify(fs.readdir);
		this.cwd = path.dirname(filePath);
		this.manifest = JSON.parse(manifest);

		this.isModified = false;
		this.runInvoked = false;
	}

	markModified() {
		this.isModified = true;
	}

	async readdir(relativePath) {
		const absolutePath = path.resolve(this.cwd, relativePath);
		return this.fsReadDir(absolutePath);
	}

	async findSupportedLocales(i18nBundleUrl) {
		const i18nBundleName = path.basename(i18nBundleUrl, ".properties");
		const i18nBundlePrefix = `${i18nBundleName}_`;
		const i18nBundleDir = path.dirname(i18nBundleUrl);
		const i18nBundleFiles = await this.readdir(i18nBundleDir);
		const supportedLocales = [];
		i18nBundleFiles.forEach((fileName) => {
			if (!fileName.endsWith(".properties")) {
				return;
			}
			const fileNameWithoutExtension = path.basename(fileName, ".properties");
			if (fileNameWithoutExtension === i18nBundleName) {
				supportedLocales.push("");
			} else if (fileNameWithoutExtension.startsWith(i18nBundlePrefix)) {
				const locale = fileNameWithoutExtension.replace(i18nBundlePrefix, "");
				supportedLocales.push(locale);
			}
		});
		return supportedLocales.sort();
	}

	async processBundleConfig(bundleConfig) {
		const bundleUrl = getBundleUrlFromConfigObject(bundleConfig, this.manifest["sap.app"].id);
		if (!bundleUrl) {
			return;
		}
		if (bundleConfig.supportedLocales) {
			return;
		}

		const supportedLocales = await this.getSupportedLocales(bundleUrl);
		if (supportedLocales.length > 0) {
			const fallbackLocale = bundleConfig.fallbackLocale;
			if (fallbackLocale && !supportedLocales.includes(fallbackLocale)) {
				log.error(
					`manifest.json: ` +
					`Generated supported locales ('${supportedLocales.join("', '")}') ` +
					"not containing the defined fallback locale '" + fallbackLocale + "'. Either provide a " +
					"properties file for defined fallbackLocale or configure another available fallbackLocale"
				);
				return;
			} else if (!fallbackLocale && !supportedLocales.includes("en")) {
				log.warn(
					`manifest.json: ` +
					`Generated supported locales ('${supportedLocales.join("', '")}') ` +
					"do not contain default fallback locale 'en'. Either provide a " +
					"properties file for 'en' or configure another available fallbackLocale"
				);
			}

			bundleConfig.supportedLocales = supportedLocales;
			this.markModified();
		}
	}

	async getSupportedLocales(bundleUrl) {
		// Ignore absolute URLs
		if (isAbsoluteUrl(bundleUrl)) {
			return [];
		}
		const sapAppId = this.manifest["sap.app"].id;
		const resolvedBundleUrl = resolveUI5Url(bundleUrl);
		if (!resolvedBundleUrl) {
			// In case of a relative ui5-protocol URL
			return [];
		}
		const normalizedBundleUrl = normalizeBundleUrl(resolvedBundleUrl, sapAppId);
		if (!normalizedBundleUrl) {
			return [];
		}
		if (normalizedBundleUrl.startsWith("../")) {
			log.verbose(
				`bundleUrl '${bundleUrl}' points to a bundle outside of the ` +
				`current namespace '${sapAppId}', enhancement of 'supportedLocales' is skipped`
			);
			return [];
		}
		return this.findSupportedLocales(normalizedBundleUrl);
	}

	async processSapAppI18n() {
		const sapApp = this.manifest["sap.app"];
		let sapAppI18n = sapApp.i18n;
		const i18nBundleUrl = getBundleUrlFromConfig(sapAppI18n, sapApp.id, "i18n/i18n.properties");

		if (!sapAppI18n?.supportedLocales && i18nBundleUrl) {
			const supportedLocales = await this.getSupportedLocales(i18nBundleUrl);
			if (supportedLocales.length > 0) {
				if (!sapAppI18n || typeof sapAppI18n === "string") {
					sapAppI18n = sapApp.i18n = {
						bundleUrl: i18nBundleUrl
					};
				}
				sapAppI18n.supportedLocales = supportedLocales;
				this.markModified();
			}
		}

		await this.processTerminologiesAndEnhanceWith(sapAppI18n);
	}

	/**
	 *	Processes the terminologies and enhanceWith bundles of a bundle configuration.
	 *
	 * @param {object} bundleConfig
	 */
	async processTerminologiesAndEnhanceWith(bundleConfig) {
		const bundleConfigs = [];

		if (bundleConfig?.terminologies) {
			bundleConfigs.push(...Object.values(bundleConfig.terminologies));
		}

		bundleConfig?.enhanceWith?.forEach((config) => {
			bundleConfigs.push(config);
			if (config.terminologies) {
				bundleConfigs.push(...Object.values(config.terminologies));
			}
		});

		await Promise.all(
			bundleConfigs.map((bundleConfig) => this.processBundleConfig(bundleConfig))
		);
	}

	async processSapUi5Models() {
		const sapUi5Models = this.manifest["sap.ui5"]?.models;
		if (typeof sapUi5Models !== "object") {
			return;
		}
		const modelConfigs = Object.values(sapUi5Models)
			.filter((modelConfig) => modelConfig.type === "sap.ui.model.resource.ResourceModel");

		await Promise.all(
			modelConfigs.map(async (modelConfig) => {
				await this.processBundleConfig(modelConfig.settings);
				await this.processTerminologiesAndEnhanceWith(modelConfig.settings);
			})
		);
	}

	async processSapUi5LibraryI18n() {
		let sapUi5LibraryI18n = this.manifest["sap.ui5"]?.library?.i18n;

		const i18nBundleUrl = getBundleUrlFromSapUi5LibraryI18n(sapUi5LibraryI18n);
		if (i18nBundleUrl && !sapUi5LibraryI18n?.supportedLocales) {
			const supportedLocales = await this.getSupportedLocales(i18nBundleUrl);
			if (supportedLocales.length > 0) {
				if (!sapUi5LibraryI18n || typeof sapUi5LibraryI18n !== "object") {
					this.manifest["sap.ui5"] ??= {};
					this.manifest["sap.ui5"].library ??= {};
					sapUi5LibraryI18n = this.manifest["sap.ui5"].library.i18n = {
						bundleUrl: i18nBundleUrl
					};
				}
				sapUi5LibraryI18n.supportedLocales = supportedLocales;
				this.markModified();
			}
		}

		await this.processTerminologiesAndEnhanceWith(sapUi5LibraryI18n);
	}

	async run() {
		// Prevent multiple invocations
		if (this.runInvoked) {
			throw new Error("ManifestEnricher#run can only be invoked once per instance");
		}
		this.runInvoked = true;

		if (!this.manifest._version) {
			log.verbose("manifest.json: _version is not defined. No supportedLocales are generated");
			return;
		}

		if (lt(this.manifest._version, APP_DESCRIPTOR_V22)) {
			log.verbose("manifest.json: _version is lower than 1.21.0 so no supportedLocales can be generated");
			return;
		}

		if (this.manifest["sap.app"].type === "library") {
			await this.processSapUi5LibraryI18n();
		} else {
			await Promise.all([
				this.processSapAppI18n(),
				this.processSapUi5Models()
			]);
		}

		if (this.isModified) {
			return this.manifest;
		}
	}
}

/**
 * @module @ui5/builder/processors/manifestEnricher
 */

/**
 * Enriches the content of the manifest.json file.
 *
 * @public
 * @function default
 * @static
 *
 * @param {object} parameters Parameters
 * @param {@ui5/fs/Resource[]} parameters.resources List of manifest.json resources to be processed
 * @param {fs|module:@ui5/fs/fsInterface} parameters.fs Node fs or custom
 *    [fs interface]{@link module:@ui5/fs/fsInterface}.
 * @returns {Promise<Array<@ui5/fs/Resource|undefined>>} Promise resolving with an array of modified resources
 */
export default async function({resources, fs}) {
	return Promise.all(
		resources.map(async (resource) => {
			const manifest = await resource.getString();
			const filePath = resource.getPath();
			const manifestEnricher = new ManifestEnricher(manifest, filePath, fs);
			const enrichedManifest = await manifestEnricher.run();
			if (enrichedManifest) {
				resource.setString(JSON.stringify(enrichedManifest, null, 2));
			}
			return resource;
		})
	);
}

export const __internals__ = (process.env.NODE_ENV === "test") ?
	{ManifestEnricher, getRelativeBundleUrlFromName, normalizeBundleUrl, resolveUI5Url} : undefined;
