import semver from "semver";
const {SemVer: Version} = semver;
import {promisify} from "node:util";
import {getLogger} from "@ui5/logger";
const log = getLogger("builder:processors:manifestTransformer");

const APP_DESCRIPTOR_V22 = new Version("1.21.0");

/**
 * Transforms i18n_en.properties to en
 *
 * @param {string} name
 */
function getLocale(name) {
	return name.substring(name.lastIndexOf("_") + 1).replaceAll(".properties", "");
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

	if (typeof sapAppBundleConfig === "string" ) {
		sapAppBundleConfig = {
			bundleUrl: sapAppBundleConfig
		};
	}

	if (sapAppBundleConfig) {
		sapAppConfig.i18n = sapAppBundleConfig;
		bundleConfigs.push(sapAppBundleConfig);
	}
	return bundleConfigs;
}

function getSapUi5ModelBundles(manifest, bundleConfigs) {
	const sapui5ModelConfig = manifest?.["sap.ui5"]?.models || {};
	return bundleConfigs.concat(Object.values(sapui5ModelConfig)
		.filter((model) => model.type === "sap.ui.model.resource.ResourceModel")
		.map((model) => model.settings));
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
	}

	if (sapui5LibraryBundleConfig) {
		sapui5LibraryConfig.i18n = sapui5LibraryBundleConfig;
		bundleConfigs.push(sapui5LibraryBundleConfig);
	}
	return bundleConfigs;
}

function getBundles(manifest) {
	let bundleConfigs = [];
	const appType = getType(manifest);

	bundleConfigs = getSapAppBundle(manifest, bundleConfigs);

	if (appType === "library") {
		bundleConfigs = getSapUi5LibrariesBundles(manifest, bundleConfigs);
	} else {
		bundleConfigs = getSapUi5ModelBundles(manifest, bundleConfigs);
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
		let propertyFilesPath = bundleUrl;

		if (bundleName) {
			propertyFilesPath = bundleName.replace(/\./g, "/") + ".properties";
		}

		const propertyFileName = propertyFilesPath.substring(propertyFilesPath.lastIndexOf("/") + 1);
		propertyFilesPath = propertyFilesPath.substring(0, propertyFilesPath.lastIndexOf("/"));

		const generatedSupportedLocales = (await readdir(`/resources/${propertyFilesPath}/!(${propertyFileName}`))
			.map((name) => getLocale(name)).sort();


		if (fallbackLocale && !isFallbackLocalePartOfSupportedLocales(fallbackLocale, generatedSupportedLocales)) {
			log.error("manifest.json: Generated supported locales ('" + generatedSupportedLocales.join("', '") + "') " +
				"not containing the defined fallback locale '" + fallbackLocale + "'. Either provide a " +
				"properties file for defined fallbackLocale or configure another available fallbackLocale");
			return;
		} else if (!fallbackLocale && !isFallbackLocalePartOfSupportedLocales("en", generatedSupportedLocales)) {
			// TO DECIDE: in case no fallbacklocale is defined locale "en" is used.
			// Should we generate supportedLocales in that case?
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
