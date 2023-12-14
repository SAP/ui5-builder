import semver from "semver";
const {SemVer: Version} = semver;
import {promisify} from "node:util";
import path from "node:path/posix";
import {getLogger} from "@ui5/logger";
const log = getLogger("builder:processors:manifestTransformer");

const APP_DESCRIPTOR_V22 = new Version("1.21.0");

/**
 * Transforms i18n_en_US.properties to en_US
 *
 * @param {string} bundleName
 * @param {string} defaultBundleName
 */
function getLocale(bundleName, defaultBundleName) {
	log.verbose("File name: " + bundleName);
	bundleName = path.basename(bundleName, ".properties");
	defaultBundleName = path.basename(defaultBundleName, ".properties");

	if (bundleName === defaultBundleName) {
		return "";
	} else {
		return bundleName.replace(defaultBundleName + "_", "");
	}
}

/**
 * Determines if manifest contain handlebars placeholder templates
 *
 * Only in case of placeholders in manifest.json the bundle configured
 * in sap.app/i18n is requested by sap/ui/core/Manifest.js
 *
 * @param {object} manifest The manifest
 * @returns {boolean}
 */
function hasManifestTemplates(manifest) {
	const rManifestTemplate = /\{\{([^}}]+)\}\}/g;
	return JSON.stringify(manifest).match(rManifestTemplate);
}

function isAutofillRequired(bundleConfig, appId) {
	const {supportedLocales, bundleUrl, bundleName} = bundleConfig;

	// TODO: check is not correct, if the manifest.json is in a subfolder the bundleUr
	// might start with a "..", see how to know bundle is outside the project
	if (bundleUrl && (bundleUrl.startsWith("..") || bundleUrl.startsWith("/"))) {
		return false;
	}

	// TODO: bundle is not inside the manifest related project but still part of UI5 project
	if (bundleName && !bundleName.startsWith(appId)) {
		return false;
	}

	// required locales are defined, so do nothing
	if (supportedLocales) {
		return false;
	}

	return true;
}

function getType(manifest) {
	return manifest["sap.app"].type;
}

function isFallbackLocalePartOfSupportedLocales(fallbackLocale, supportedLocales) {
	return supportedLocales.includes(fallbackLocale);
}

function hasBundleTerminologies(bundleConfig) {
	return bundleConfig?.terminologies && Object.keys(bundleConfig.terminologies).length > 0;
}


function getTerminologieBundles(bundleConfig, bundleConfigs) {
	const terminologyBundles = [];
	if (hasBundleTerminologies(bundleConfig)) {
		Object.keys(bundleConfig.terminologies).forEach((key) => {
			terminologyBundles.push(bundleConfig.terminologies[key]);
		});
	}
	bundleConfigs.push(...terminologyBundles);
}

function getEnhanceWithBundles(bundleConfig, bundleConfigs) {
	if (!bundleConfig.enhanceWith) {
		return bundleConfigs;
	}

	bundleConfig.enhanceWith.forEach((config) => {
		getTerminologieBundles(config, bundleConfigs);
	});

	bundleConfigs.push(...bundleConfig.enhanceWith);
}

function getSapAppBundle(manifest, bundleConfigs) {
	const sapAppConfig = manifest["sap.app"];
	let sapAppBundleConfig = sapAppConfig?.i18n;

	if (getType(manifest) !== "library") {
		if (hasManifestTemplates(manifest)) {
			// sap/ui/core/Manifest defaults sap.app/i18n to "i18n/i18n.properties"
			// when template is used in manifest.json
			sapAppBundleConfig = sapAppBundleConfig || "i18n/i18n.properties";
		} else {
			sapAppBundleConfig = undefined;
		}
	}

	if (!sapAppBundleConfig) {
		return bundleConfigs;
	}

	if (typeof sapAppBundleConfig === "string" ) {
		sapAppBundleConfig = {
			bundleUrl: sapAppBundleConfig
		};
	} else {
		getTerminologieBundles(sapAppBundleConfig, bundleConfigs);
		getEnhanceWithBundles(sapAppBundleConfig, bundleConfigs);
	}

	sapAppConfig.i18n = sapAppBundleConfig;
	bundleConfigs.push(sapAppBundleConfig);
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

function getBundles(manifest) {
	const bundleConfigs = [];
	const appType = getType(manifest);

	getSapAppBundle(manifest, bundleConfigs);

	if (appType === "library") {
		getSapUi5LibrariesBundles(manifest, bundleConfigs);
	} else {
		getSapUi5ModelBundles(manifest, bundleConfigs);
	}

	return bundleConfigs
		.filter((bundleConfig) => isAutofillRequired(bundleConfig, manifest["sap.app"].id));
}

async function transformManifest(resource, readdir, options) {
	// merge options with defaults
	options = Object.assign({
		prettyPrint: true,
	}, options);
	const content = await resource.getString();

	// in case of server middleware --> isNamespaced ist false
	const namespace = resource.getProject().getNamespace();
	const isNamespaced = resource.getPath().includes(namespace);

	const manifest = JSON.parse(content);

	if (!manifest._version) {
		log.verbose("manifest.json: version is not defined. No supportedLocales are generated");
		return;
	}

	const descriptorVersion = new Version(manifest._version);
	if (descriptorVersion.compare(APP_DESCRIPTOR_V22) === -1) {
		log.verbose("manifest.json: version is lower than 1.21.0 so no supportedLocales can be generated");
		return;
	}

	const bundles = getBundles(manifest);

	if (bundles.length === 0) {
		return;
	}

	// check which locales are avalable
	await Promise.all(bundles.map(async (bundleConfig) => {
		const {bundleUrl, bundleName, fallbackLocale} = bundleConfig;
		let defaultBundleName = bundleUrl;

		if (bundleName) {
			defaultBundleName = bundleName.replace(/\./g, "/");
			defaultBundleName = defaultBundleName.replace(namespace, "");
		}

		if (bundleUrl) {
			defaultBundleName = bundleUrl.replace(".properties", "");
		}


		let pathToDefaultBundleName = "";

		if (isNamespaced) {
			pathToDefaultBundleName= `/resources/${namespace}`;
		}

		pathToDefaultBundleName = path.join(pathToDefaultBundleName, defaultBundleName);

		log.verbose("File: " + defaultBundleName);
		log.verbose("Path: " + path);

		const generatedSupportedLocales = (await readdir(path.dirname(pathToDefaultBundleName)))
			.filter((name) => name.endsWith(".properties") && name.startsWith(path.basename(defaultBundleName)))
			.map((name) => {
				log.verbose("File name: " + name);
				return getLocale(name, defaultBundleName);
			}).sort();

		log.verbose("Generated locales: " + generatedSupportedLocales.toString());

		if (fallbackLocale && !isFallbackLocalePartOfSupportedLocales(fallbackLocale, generatedSupportedLocales)) {
			log.error("manifest.json: Generated supported locales ('" + generatedSupportedLocales.join("', '") + "') " +
				"not containing the defined fallback locale '" + fallbackLocale + "'. Either provide a " +
				"properties file for defined fallbackLocale or configure another available fallbackLocale");
			return;
		} else if (!fallbackLocale && !isFallbackLocalePartOfSupportedLocales("en", generatedSupportedLocales)) {
			log.warn("manifest.json: Generated supported locales ('" + generatedSupportedLocales.join("', '") + "') " +
				"do not contain default fallback locale 'en'. Either provide a " +
				"properties file for 'en' or configure another available fallbackLocale");
		}

		bundleConfig.supportedLocales = generatedSupportedLocales;
	}));

	resource.setString(JSON.stringify(manifest, null, options.prettyPrint ? "  " : undefined));
	return resource;
}


/**
 * @module @ui5/builder/processors/manifestTransformer
 */

/**
 * Transforms the content of the manifest.json file.
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
 * @returns {Promise<@ui5/fs/Resource[]>} Promise resolving with the cloned resources
 */
export default function({resources, fs, options}) {
	return Promise.all(resources.map(async (resource) => transformManifest(resource, promisify(fs.readdir), options)));
}
