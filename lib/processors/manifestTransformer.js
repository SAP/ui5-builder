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

function isAutoFillExplicitlyDeactivated(supportedLocales) {
	return supportedLocales && Array.isArray(supportedLocales) &&
		supportedLocales.length === 1 && supportedLocales[0] === "";
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

	if (bundleName && !bundleName.startsWith(appId)) {
		return false;
	}

	// TODO: Clarify if check isAutoFillExplicitlyDeactivated is needed
	if (!supportedLocales) {
		return true;
	} else if (isAutoFillExplicitlyDeactivated(supportedLocales)) {
		return false;
	} else {
		// required locales are defined, so do nothing
		return false;
	}
}

function getBundles(manifest) {
	const sapui5ModelConfig = manifest?.["sap.ui5"]?.models || {};
	const bundleConfigs = Object.values(sapui5ModelConfig)
		.filter((model) => model.type === "sap.ui.model.resource.ResourceModel")
		.map((model) => model.settings);

	if (hasManifestTemplates(manifest)) {
		const sapAppConfig = manifest["sap.app"];
		const appType = sapAppConfig.type;

		let sapAppBundleConfig = sapAppConfig?.i18n;

		if (!sapAppBundleConfig) {
			if (appType === "library") {
				// sap.ui.core.Lib empty bundle url to "i18n/messagebundle.properties"
				sapAppBundleConfig = "i18n/messagebundle.properties";
			} else {
				// sap/ui/core/Manifest defaults sap.app/i18n to "i18n/i18n.properties"
				sapAppBundleConfig = "i18n/i18n.properties";
			}
		}

		if (typeof sapAppBundleConfig === "string" ) {
			sapAppBundleConfig = {
				bundleUrl: sapAppBundleConfig
			};
		}
		bundleConfigs.push(sapAppBundleConfig);
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

	// Log a verbose message and don't generate supportedLocales if manifest "_version" (root level) is not set at all.
	// This might indicate that the file just shares the name coincidentally
	if (!manifest._version) {
		log.verbose("Manifest version is not defined. No supportedLocales are generated");
		return;
	}

	// Log a verbose message and don't generate supportedLocales
	//  if manifest "_version" (root level) is lower than 1.21.0
	const descriptorVersion = new Version(manifest._version);
	if (descriptorVersion.compare(APP_DESCRIPTOR_V22) === -1) {
		log.verbose("Manifest version is lower than 1.21.0 so no supportedLocales can be generated");
		return;
	}

	const bundles = getBundles(manifest);

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

		// Log an error and don't generate the supportedLocales if generated not contain the defined fallbackLocale
		if (generatedSupportedLocales.indexOf(fallbackLocale) === -1) {
			// eslint-disable-next-line max-len
			log.error(`manifest.json: Generated supported locales ${generatedSupportedLocales.toString()} does not contain the defined fallback locale '${fallbackLocale}'`);
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
