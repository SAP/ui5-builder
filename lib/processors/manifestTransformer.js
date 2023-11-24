import semver from "semver";
const {SemVer: Version} = semver;
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
	const rManifestTemplate = /\{\{([^\}\}]+)\}\}/g;
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

function getSapAppBundle(manifest, bundleConfigs) {
	const sapAppConfig = manifest["sap.app"];
	let sapAppBundleConfig = sapAppConfig?.i18n;

	if (getType(manifest) === "library") {
		if (!sapAppBundleConfig) {
			// sap.ui.core.Lib empty bundle url to "messagebundle.properties"
			sapAppBundleConfig = "messagebundle.properties";
		}
		// library with custom property file
	} else {
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
	const sapui5LibraryBundleConfig = manifest?.["sap.ui5"]?.library?.i18n;

	if (!sapui5LibraryBundleConfig) {
		return bundleConfigs;
	}

	let libraryBundleConfig;

	if (typeof sapui5LibraryBundleConfig === "string") {
		libraryBundleConfig = {
			bundleUrl: sapui5LibraryBundleConfig
		};
	} else if (typeof sapui5LibraryBundleConfig === "boolean") {
		libraryBundleConfig = {
			bundleUrl: "messagebundle.properties"
		};
	} else if (!sapui5LibraryBundleConfig.supportedLocales) {
		libraryBundleConfig = {
			bundleUrl: sapui5LibraryBundleConfig.bundleUrl
		};
	}

	if (libraryBundleConfig) {
		bundleConfigs.push(libraryBundleConfig);
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

async function transformManifest(resource, fs, options) {
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
		const {bundleUrl, bundleName, fallbackLocale = "en"} = bundleConfig;
		let propertyFilesPath = bundleUrl;

		if (bundleName) {
			propertyFilesPath = bundleName.replace(/\./g, "/") + ".properties";
		}

		const propertyFileName = propertyFilesPath.substring(propertyFilesPath.lastIndexOf("/") + 1);
		propertyFilesPath = propertyFilesPath.substring(0, propertyFilesPath.lastIndexOf("/"));

		const generatedSupportedLocales = fs.readdir(`/resources/${propertyFilesPath}/!(${propertyFileName}`)
			.map((name) => getLocale(name)).sort();

		// TO DECIDE: in case no fallbacklocale is defined "en" is used. Should we generate supportedLocales in that case?
		if (generatedSupportedLocales.indexOf(fallbackLocale) === -1) {
			log.error("manifest.json: Generated supported locales ('" + generatedSupportedLocales.join("', '") + "') " +
				"not containing the defined fallback locale '" + fallbackLocale + "'. Either provide a " +
				"properties file for defined fallbackLocale or configure another available fallbackLocale");
			return;
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
 *    [fs interface]{@link module:@ui5/fs/fsInterface}. Required when setting "readSourceMappingUrl" to true
 * @param {object} parameters.options Options
 * @returns {Promise<@ui5/fs/Resource[]>} Promise resolving with the cloned resources
 */
export default function({resources, fs, options}) {
	return Promise.all(resources.map(async (resource) => transformManifest(resource, fs, options)));
}
