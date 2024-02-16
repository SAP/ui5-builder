import semver from "semver";
const {SemVer: Version} = semver;
import {promisify} from "node:util";
import path from "node:path/posix";
import {getLogger} from "@ui5/logger";
const log = getLogger("builder:processors:manifestEnricher");

const APP_DESCRIPTOR_V22 = new Version("1.21.0");

function getType(manifest) {
	return manifest["sap.app"].type;
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
			// TODO: Also throw an error here?
			throw new Error("URLs using the 'ui5' protocol must be absolute. Relative and server absolute URLs are reserved for future use.");
		}

		sNoScheme = sNoScheme.replace("//", "");

		return "/resources/" + sNoScheme;
	} else {
		// not a ui5 url
		return sUrl;
	}
}

/**
 * Normalizes a bundle URL and resolves ui5:// protocol URLs.
 *
 * @param {string} bundleUrl Relative bundle URL to be normalized
 * @param {string} sapAppId Project namespace from sap.app/id (e.g. "sap.ui.demo.app")
 *                          to which the URL is relative to
 * @returns {string} Normalized relative bundle URL (e.g. "i18n/i18n.properties")
 */
function normalizeBundleUrl(bundleUrl, sapAppId) {
	bundleUrl = resolveUI5Url(bundleUrl);

	// Check if the bundleUrl is already resolved?
	// TODO: should we ignore such cases and not add supportedLocales?

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
	constructor(fs, manifestPath) {
		this.fsReadDir = promisify(fs.readdir);
		this.cwd = path.dirname(manifestPath);
		this.modified = false;
	}

	markModified() {
		this.modified = true;
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
		const supportedLocales = new Set();
		i18nBundleFiles.forEach((fileName) => {
			if (!fileName.endsWith(".properties")) {
				return;
			}
			const fileNameWithoutExtension = path.basename(fileName, ".properties");
			if (fileNameWithoutExtension === i18nBundleName) {
				supportedLocales.add("");
			} else if (fileNameWithoutExtension.startsWith(i18nBundlePrefix)) {
				const locale = fileNameWithoutExtension.replace(i18nBundlePrefix, "");
				supportedLocales.add(locale);
			}
		});
		return supportedLocales;
	}

	async processBundleConfig(bundleConfig, manifest) {
		const bundleUrl = getBundleUrlFromConfig(bundleConfig, manifest["sap.app"].id);
		if (!bundleUrl) {
			return;
		}
		if (bundleConfig.supportedLocales) {
			return;
		}
		const normalizedBundleUrl = normalizeBundleUrl(bundleUrl, manifest["sap.app"].id);
		if (normalizedBundleUrl.startsWith("../")) {
			return;
		}
		const supportedLocales = await this.findSupportedLocales(normalizedBundleUrl);
		if (supportedLocales.size > 0) {
			const fallbackLocale = bundleConfig.fallbackLocale;
			if (fallbackLocale && !supportedLocales.has(fallbackLocale)) {
				log.error(
					`manifest.json: ` +
					`Generated supported locales ('${Array.from(supportedLocales).join("', '")}') ` +
					"not containing the defined fallback locale '" + fallbackLocale + "'. Either provide a " +
					"properties file for defined fallbackLocale or configure another available fallbackLocale"
				);
				return;
			} else if (!fallbackLocale && !supportedLocales.has("en")) {
				log.warn(
					`manifest.json: ` +
					`Generated supported locales ('${Array.from(supportedLocales).join("', '")}') ` +
					"do not contain default fallback locale 'en'. Either provide a " +
					"properties file for 'en' or configure another available fallbackLocale"
				);
			}

			bundleConfig.supportedLocales = Array.from(supportedLocales);
			this.markModified();
		}
	}

	async processSapAppI18n(manifest) {
		// sap.app/i18n is not applicable to libraries
		if (getType(manifest) === "library") {
			return;
		}
		const sapApp = manifest["sap.app"];
		let sapAppI18n = sapApp.i18n;
		const i18nBundleUrl = getBundleUrlFromConfig(sapAppI18n, sapApp.id, "i18n/i18n.properties");

		if (!sapAppI18n?.supportedLocales && i18nBundleUrl) {
			const normalizedI18nBundleUrl = normalizeBundleUrl(i18nBundleUrl, sapApp.id);
			if (normalizedI18nBundleUrl.startsWith("../")) {
				return;
			}

			const supportedLocales = await this.findSupportedLocales(normalizedI18nBundleUrl);
			if (supportedLocales.size > 0) {
				if (!sapAppI18n || typeof sapAppI18n === "string") {
					sapAppI18n = sapApp.i18n = {
						bundleUrl: i18nBundleUrl
					};
				}
				sapAppI18n.supportedLocales = Array.from(supportedLocales);
				this.markModified();
			}
		}
	}

	async processSapUi5ModelConfig(modelConfig, manifest) {
		const bundleConfigs = [modelConfig.settings];

		if (modelConfig.settings.terminologies) {
			bundleConfigs.push(...Object.values(modelConfig.settings.terminologies));
		}

		modelConfig.settings.enhanceWith?.forEach((config) => {
			bundleConfigs.push(config);
			if (config.terminologies) {
				bundleConfigs.push(...Object.values(config.terminologies));
			}
		});

		await Promise.all(
			bundleConfigs.map((bundleConfig) => this.processBundleConfig(bundleConfig, manifest))
		);
	}

	async processSapUi5Models(manifest) {
		// sap.ui5/models is not applicable to libraries
		if (getType(manifest) === "library") {
			return;
		}
		const sapUi5Models = manifest["sap.ui5"]?.models;
		if (typeof sapUi5Models !== "object") {
			return;
		}
		const modelConfigs = Object.values(sapUi5Models)
			.filter((modelConfig) => modelConfig.type === "sap.ui.model.resource.ResourceModel");

		await Promise.all(
			modelConfigs.map((modelConfig) => this.processSapUi5ModelConfig(modelConfig, manifest))
		);
	}

	async processSapUi5LibraryI18n(manifest) {
		// sap.ui5/library/i18n is only applicable to libraries
		if (getType(manifest) !== "library") {
			return;
		}
		const sapAppId = manifest["sap.app"].id;

		let sapUi5LibraryI18n = manifest["sap.ui5"]?.library?.i18n;

		const i18nBundleUrl = getBundleUrlFromSapUi5LibraryI18n(sapUi5LibraryI18n);
		if (i18nBundleUrl && !sapUi5LibraryI18n?.supportedLocales) {
			const normalizedI18nBundleUrl = normalizeBundleUrl(i18nBundleUrl, sapAppId);
			if (normalizedI18nBundleUrl.startsWith("../")) {
				return;
			}

			const supportedLocales = await this.findSupportedLocales(normalizedI18nBundleUrl);
			if (supportedLocales.size > 0) {
				if (!sapUi5LibraryI18n || typeof sapUi5LibraryI18n !== "object") {
					manifest["sap.ui5"] ??= {};
					manifest["sap.ui5"].library ??= {};
					sapUi5LibraryI18n = manifest["sap.ui5"].library.i18n = {
						bundleUrl: i18nBundleUrl
					};
				}
				sapUi5LibraryI18n.supportedLocales = Array.from(supportedLocales);
				this.markModified();
			}
		}
	}

	async enrichManifest(resource, options) {
		this.modified = false;

		// merge options with defaults
		options = Object.assign({
			prettyPrint: true,
		}, options);

		const content = await resource.getString();
		const manifest = JSON.parse(content);

		if (!manifest._version) {
			log.verbose("manifest.json: _version is not defined. No supportedLocales are generated");
			return;
		}

		const descriptorVersion = new Version(manifest._version);
		if (descriptorVersion.compare(APP_DESCRIPTOR_V22) === -1) {
			log.verbose("manifest.json: _version is lower than 1.21.0 so no supportedLocales can be generated");
			return;
		}

		await Promise.all([
			this.processSapAppI18n(manifest),
			this.processSapUi5Models(manifest),
			this.processSapUi5LibraryI18n(manifest)
		]);

		if (this.modified) {
			resource.setString(JSON.stringify(manifest, null, options.prettyPrint ? 2 : undefined));
			return resource;
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
 * @param {object} parameters.options Options
 * @returns {Promise<Array<@ui5/fs/Resource|undefined>>} Promise resolving with an array of modified resources
 */
export default async function({resources, fs, options}) {
	return Promise.all(
		resources.map(async (resource) => {
			const manifestEnricher = new ManifestEnricher(fs, resource.getPath());
			return manifestEnricher.enrichManifest(resource, options);
		})
	);
}

export const __internals__ = (process.env.NODE_ENV === "test") ?
	{ManifestEnricher, getRelativeBundleUrlFromName, normalizeBundleUrl} : undefined;
