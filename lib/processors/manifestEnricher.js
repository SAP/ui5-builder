import semver from "semver";
const {SemVer: Version} = semver;
import {promisify} from "node:util";
import path from "node:path/posix";
import {getLogger} from "@ui5/logger";
const log = getLogger("builder:processors:manifestEnricher");

const APP_DESCRIPTOR_V22 = new Version("1.21.0");

function hasBundleTerminologies(bundleConfig) {
	return bundleConfig?.terminologies && Object.keys(bundleConfig.terminologies).length > 0;
}

function getSapUi5ModelBundles(manifest, bundleConfigs) {
	const sapui5ModelConfig = manifest?.["sap.ui5"]?.models || {};
	const sapui5ModelConfigBundles = Object.values(sapui5ModelConfig)
		.filter((model) => model.type === "sap.ui.model.resource.ResourceModel")
		.map((model) => model.settings);
	sapui5ModelConfigBundles.forEach((bundleConfig) => {
		getTerminologieBundles(bundleConfig, bundleConfigs);
		getEnhanceWithBundles(bundleConfig, bundleConfigs);
	});
	bundleConfigs.push(...sapui5ModelConfigBundles);
}

function getSapUi5LibrariesBundles(manifest, bundleConfigs) {
	const sapui5LibraryConfig = manifest?.["sap.ui5"]?.library;
	let sapui5LibraryBundleConfig = sapui5LibraryConfig?.i18n;

	if (!sapui5LibraryBundleConfig) {
		return bundleConfigs;
	}

	if (typeof sapui5LibraryBundleConfig === "string") {
		sapui5LibraryBundleConfig = {
			bundleUrl: sapui5LibraryBundleConfig
		};
	} else if (typeof sapui5LibraryBundleConfig === "boolean") {
		sapui5LibraryBundleConfig = {
			bundleUrl: "messagebundle.properties"
		};
	} else {
		getTerminologieBundles(sapui5LibraryBundleConfig, bundleConfigs);
		getEnhanceWithBundles(sapui5LibraryBundleConfig, bundleConfigs);
	}

	sapui5LibraryConfig.i18n = sapui5LibraryBundleConfig;
	bundleConfigs.push(sapui5LibraryBundleConfig);
}

function getType(manifest) {
	return manifest["sap.app"].type;
}

function getBundleUrlFromName(bundleName) {
	return bundleName.replace(/\./g, "/") + ".properties";
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
 * @param {string} [defaultBundleUrl] Default bundle url in case bundleConfig is not defined
 */
function getBundleUrlFromConfig(bundleConfig, defaultBundleUrl) {
	if (!bundleConfig) {
		// Use default URL (or undefined if argument is not provided)
		return defaultBundleUrl;
	} else if (typeof bundleConfig === "string") {
		return bundleConfig;
	} else if (typeof bundleConfig === "object") {
		if (bundleConfig.bundleName) {
			return getBundleUrlFromName(bundleConfig.bundleName);
		} else if (bundleConfig.bundleUrl) {
			return bundleConfig.bundleUrl;
		}
	}
}

class ManifestEnricher {
	constructor(fs, manifestPath) {
		this.fsReadDir = promisify(fs.readdir);
		this.cwd = path.dirname(manifestPath);
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

	async processSapAppI18n(manifest) {
		// sap.app/i18n is not applicable to libraries
		if (getType(manifest) === "library") {
			return false;
		}
		const sapApp = manifest["sap.app"];
		let sapAppI18n = sapApp.i18n;
		const i18nBundleUrl = getBundleUrlFromConfig(sapAppI18n, "i18n/i18n.properties");

		if (!sapAppI18n?.supportedLocales && i18nBundleUrl) {
			const normalizedI18nBundleUrl = normalizeBundleUrl(i18nBundleUrl, sapApp.id);
			if (normalizedI18nBundleUrl.startsWith("../")) {
				return false;
			}

			const supportedLocales = await this.findSupportedLocales(normalizedI18nBundleUrl);
			if (supportedLocales.size > 0) {
				if (!sapAppI18n || typeof sapAppI18n === "string") {
					sapAppI18n = sapApp.i18n = {
						bundleUrl: i18nBundleUrl
					};
				}
				sapAppI18n.supportedLocales = Array.from(supportedLocales);
				return true;
			}
		}
		return false;
	}

	async processSapUi5Models(manifest) {
		// sap.ui5/models is not applicable to libraries
		if (getType(manifest) === "library") {
			return false;
		}
		const sapUi5Models = manifest["sap.ui5"]?.models;
		if (typeof sapUi5Models !== "object") {
			return false;
		}
		const bundleConfigs = Object.values(sapUi5Models)
			.filter((modelConfig) => modelConfig.type === "sap.ui.model.resource.ResourceModel");
		const modifications = await Promise.all(
			bundleConfigs.map(async (modelConfig) => {
				const bundleUrl = getBundleUrlFromConfig(modelConfig.settings?.bundleUrl);
				if (!bundleUrl) {
					return false;
				}
				if (modelConfig.settings.supportedLocales) {
					return false;
				}
				const normalizedBundleUrl = normalizeBundleUrl(bundleUrl, manifest["sap.app"].id);
				if (normalizedBundleUrl.startsWith("../")) {
					return false;
				}
				const supportedLocales = await this.findSupportedLocales(normalizedBundleUrl);
				if (supportedLocales.size > 0) {
					modelConfig.settings.supportedLocales = Array.from(supportedLocales);
					return true;
				}
			})
		);
		return modifications.some(Boolean);
	}

	async enrichManifest(resource, options) {
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

		const modifications = await Promise.all([
			this.processSapAppI18n(manifest),
			this.processSapUi5Models(manifest)
		]);

		if (modifications.some(Boolean)) {
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
	{ManifestEnricher, getBundleUrlFromName, normalizeBundleUrl} : undefined;
