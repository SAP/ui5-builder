"use strict";

const {SemVer: Version} = require("semver");
const log = require("@ui5/logger").getLogger("builder:processors:manifestCreator");
const EvoResource = require("@ui5/fs").Resource;
const xml2js = require("xml2js");
const analyzeLibraryJS = require("../lbt/analyzer/analyzeLibraryJS");

/*
 * A single parse instance to be used by all invocations (TODO check reentrance capa of xml2js)
 */
const parser = new xml2js.Parser({
	// explicitChildren: true,
	preserveChildrenOrder: true,
	xmlns: true
});

// const APP_DESCRIPTOR_V3 = new Version("1.2.0");
const APP_DESCRIPTOR_V3_SECTION_SAP_APP = new Version("1.2.0");
const APP_DESCRIPTOR_V3_OTHER_SECTIONS = new Version("1.1.0");
const APP_DESCRIPTOR_V5 = new Version("1.4.0");
const APP_DESCRIPTOR_V10 = new Version("1.9.0");

// namespaces used in .library files
const XMLNS_UILIB = "http://www.sap.com/sap.ui.library.xsd";
const XMLNS_OWNERSHIP = "http://www.sap.com/ui5/buildext/ownership";
const XMLNS_MANIFEST = "http://www.sap.com/ui5/buildext/manifest";
const XMLNS_THIRDPARTY = "http://www.sap.com/ui5/buildext/thirdparty";

function getAttribute(node, attr) {
	return (node.$ && node.$[attr] && node.$[attr].value) || null;
}

function getBooleanAttribute(node, attr) {
	return getAttribute(node, attr) === "true";
}

function findChild(node, tagName, namespaceURI) {
	if ( node &&
			Array.isArray(node[tagName]) &&
			node[tagName].length > 0 &&
			(namespaceURI == null || (node[tagName][0].$ns && node[tagName][0].$ns.uri === namespaceURI)) ) {
		return node[tagName][0];
	}
}

function findChildren(node, tagName, namespaceURI) {
	const children = node && node[tagName];
	if ( Array.isArray(children) ) {
		return children.filter((child) => (namespaceURI == null || (child.$ns && child.$ns.uri === namespaceURI)));
	}
	return [];
}

function getChildTextContent(node, tagName, defaultValue) {
	const child = findChild(node, tagName);
	return child ? (child._ || "") : defaultValue;
}

class Dependency {
	constructor(xml) {
		this.xml = xml;
	}

	getLibraryName() {
		return getChildTextContent(this.xml, "libraryName");
	}

	getVersion() {
		return getChildTextContent(this.xml, "version");
	}

	isLazy() {
		return "true" === getChildTextContent(this.xml, "lazy");
	}
}

class Library {
	constructor(xml) {
		this.xml = xml;
	}

	getVersion() {
		return getChildTextContent(this.xml, "version");
	}

	getName() {
		return getChildTextContent(this.xml, "name");
	}

	getTitle() {
		return getChildTextContent(this.xml, "title");
	}

	getDocumentation() {
		return getChildTextContent(this.xml, "documentation");
	}

	getDependencies() {
		const container = findChild(this.xml, "dependencies");
		const deps = findChildren(container, "dependency") || [];
		return deps.map((dep) => new Dependency(dep));
	}

	getAppData(tagName, namespace) {
		const appData = findChild(this.xml, "appData", XMLNS_UILIB);
		return findChild(appData, tagName, namespace);
	}

	static async from(resource) {
		const content = await resource.getString();
		return new Promise( (resolve, reject) => {
			parser.parseString(content, (err, xml) => {
				if ( err ) {
					reject(err);
				}
				resolve(new Library(xml.library));
			});
		});
	}
}


class LibraryBundle {
	constructor(prefix, resources) {
		this.prefix = prefix;
		this.resources = resources.filter((res) => res.getPath().startsWith(prefix));
	}
	findResource(name) {
		return this.resources.find((res) => res.getPath() === this.prefix + name);
	}
	getResources(pattern) {
		return this.resources.filter((res) => pattern == null || pattern.test(res.getPath()));
	}
}

/*
 * Creates the library manifest.json file for a UILibrary.
 */
async function createManifest(libraryResource, libBundle, descriptorVersion, _include3rdParty) {
	// create a Library wrapper around the .library XML
	const library = await Library.from(libraryResource);

	// collect information from library.js file
	const libraryJSInfo = await analyzeLibraryJS(libBundle.findResource("library.js"));

	const manifestAppData = library.getAppData("manifest", XMLNS_MANIFEST);
	const sapFioriAppData = findChild(manifestAppData, "sap.fiori");

	function sectionVersion(candidateVersion) {
		// _version property for nested sections became optional with AppDescriptor V5
		if ( descriptorVersion.compare(APP_DESCRIPTOR_V5) < 0 ) {
			return candidateVersion;
		}
		// return undefined
	}

	function createSapApp() {
		function findComponentPaths() {
			const result = [];
			const prefix = libraryResource.getPath().slice(0, - ".library".length);
			const components = libBundle.getResources(/^\/(?:[^/]+\/)*Component\.js$/);
			components.forEach((comp) => {
				const relativePath = comp.getPath().slice(prefix.length);
				if ( relativePath.lastIndexOf("/") >= 0 ) {
					result.push( relativePath.slice(0, relativePath.lastIndexOf("/")) );
				} else if ( prefix !== "/resources/sap/ui/core/" ) {
					log.error("Package %s contains both '*.library' and 'Component.js'. " +
						"This is not supported by manifests, therefore the component won't be " +
						"listed in the library's manifest.", comp.getPath());
				}
			});
			return result.sort();
		}

		function isValid(version) {
			return version && version !== "@version@" && version !== "${version}";
		}

		function getProjectVersion() {
			const project = libraryResource._project;
			if ( project ) {
				return project.version;
			}
		}

		function getLibraryTitle() {
			if ( library.getTitle() ) {
				return library.getTitle();
			}
			if ( library.getDocumentation() ) {
				let desc = library.getDocumentation();
				// remove all tags
				desc = desc.replace(/\\s+/g, " ").replace(/<\/?[a-zA-Z][a-zA-Z0-9_$.]*(\s[^>]*)>/g, "");
				// extract summary (first sentence)
				const m = /^([\w\W]+?[.;!?])[^a-zA-Z0-9_$]/.exec(desc);
				return m ? m[1] : desc;
			}
			return library.getName();
		}

		function getDefaultACH() {
			const ownership = library.getAppData("ownership", XMLNS_OWNERSHIP);
			for (const comp of findChildren(ownership, "component")) {
				if ( comp._ ) {
					return comp._;
				}
			}
		}

		function offline() {
			let result = sapFioriAppData == null ? true : false;
			const offlineElement = findChild(manifestAppData, "offline");
			if ( offlineElement ) {
				result = offlineElement._ === "true";
			}
			return result;
		}

		function sourceTemplate() {
			const sourceTemplateElement = findChild(manifestAppData, "sourceTemplate");
			if ( sourceTemplateElement ) {
				return {
					"id": getChildTextContent(sourceTemplateElement, "id"),
					"version": getChildTextContent(sourceTemplateElement, "version")
				};
			}
		}

		function openSourceComponents() {
			const embeddedOSComponents = new Set();
			const osComponents = [];
			for (const osCompElem of findChildren(manifestAppData, "openSourceComponent")) {
				const name = getAttribute(osCompElem, "name");
				const packagedWithMySelf = getBooleanAttribute(osCompElem, "packagedWithMySelf");
				osComponents.push({
					name: name,
					packagedWithMySelf,
					version: packagedWithMySelf ? getAttribute(osCompElem, "version") : undefined
				});
				if ( packagedWithMySelf ) {
					embeddedOSComponents.add(name);
				}
			}

			if ( _include3rdParty ) {
				// also merge all thirdparty libs, but only with the name - version info is not available
				// only merge in if no lib with the same name has been declared already
				const thirdpartyAppData = library.getAppData("thirdparty", XMLNS_THIRDPARTY);
				for (const thirdPartyElem of findChildren(thirdpartyAppData, "lib")) {
					const osCompName = getAttribute(thirdPartyElem, "name");
					if ( !embeddedOSComponents.has(osCompName) ) {
						embeddedOSComponents.add(osCompName);
						osComponents.push({
							name: osCompName,
							packagedWithMySelf: true,
							version: getAttribute(thirdPartyElem, "version") || "0.0.0"
						});
					}
				}
			}

			return osComponents.length > 0 ? osComponents : undefined;
		}

		const sapApp = {
			_version: sectionVersion(APP_DESCRIPTOR_V3_SECTION_SAP_APP),
			id: library.getName(),
			type: "library",
			embeds: findComponentPaths(),
			i18n: getChildTextContent(manifestAppData, "i18n"),
			applicationVersion: {
				version: isValid(library.getVersion()) ? library.getVersion() : getProjectVersion()
			},
			title: getLibraryTitle(),
			description: library.getDocumentation(),
			ach: getDefaultACH(), // optional, might be undefined
			resources: "resources.json",
			offline: offline(),
			sourceTemplate: sourceTemplate(),
			openSourceComponents: openSourceComponents()
		};

		log.verbose("  sap.app/id taken from .library: '%s'", sapApp.id);
		log.verbose("  sap.app/embeds determined from resources: '%s'", sapApp.embeds);
		log.verbose("  sap.app/i18n taken from .library appData: '%s'", sapApp.i18n);
		log.verbose("  sap.app/ach taken from .library appData/ownership: '%s'", sapApp.ach);

		return sapApp;
	}

	function createSapUi() {
		function deviceTypes() {
			const deviceTypesElement = findChild(manifestAppData, "deviceTypes");
			if ( deviceTypesElement ) {
				return {
					desktop: getBooleanAttribute(deviceTypesElement, "desktop"),
					tablet: getBooleanAttribute(deviceTypesElement, "tablet"),
					phone: getBooleanAttribute(deviceTypesElement, "phone"),
				};
			}
		}

		function collectThemes() {
			const themes = {};

			// find theme resources and determine theme names from their paths
			libBundle.getResources(/(?:[^/]+\/)*themes\//).forEach((res) => {
				const match = /\/themes\/([^/]+)\//.exec(res.getPath());
				if ( match ) {
					themes[match[1]] = true;
				}
			});

			// merge with supporteTheme info from .library file
			const elems = findChildren(manifestAppData, "supportedTheme");
			if ( elems ) {
				elems.forEach((elem) => {
					if ( elem._ ) {
						themes[elem._];
					}
				});
			}
			return Object.keys(themes).sort();
		}

		const sapUi = {
			_version: sectionVersion(APP_DESCRIPTOR_V3_OTHER_SECTIONS),
			technology: "UI5",
			deviceTypes: deviceTypes(),
			supportedThemes: collectThemes()
		};

		log.verbose("  sap.ui/supportedThemes determined from resources: '%s'", sapUi.supportedThemes);

		return sapUi;
	}

	function createSapUI5() {
		function getUI5Version() {
			let ui5Version;
			if ( ui5Version != null ) {
				return ui5Version;
			}

			const dummy = new Dependency({
				libraryName: [{
					_: "sap.ui.core"
				}]
			});
			return normalizeVersion(getVersion(dummy));
		}

		function dependencies() {
			const dependencies = {
				minUI5Version: getUI5Version(),
				libs: {
				}
			};
			if ( library.getDependencies() != null ) {
				for (const dep of library.getDependencies()) {
					dependencies.libs[dep.getLibraryName()] = {
						minVersion: getVersion(dep),
						lazy: dep.isLazy() || undefined // suppress default (false)
					};
				}
			}
			log.verbose("  sap.ui5/dependencies/libs determined from .library dependencies: '%s'", dependencies.libs);
			return dependencies;
		}

		function contentDensities() {
			const contentDensitiesElement = findChild(manifestAppData, "contentDensities");
			if ( contentDensitiesElement != null ) {
				const contentDensities = {
					cozy: getBooleanAttribute(contentDensitiesElement, "cozy"),
					compact: getBooleanAttribute(contentDensitiesElement, "compact")
				};
				log.verbose("  sap.ui5/contentDensities property taken from .library appData: '%s'", contentDensities);
				return contentDensities;
			}
		}

		function createLibraryMetadata() {
			if ( descriptorVersion.compare(APP_DESCRIPTOR_V10) < 0 ) {
				log.verbose("  target descriptor version %s: skipping sap.ui5/library information",
					descriptorVersion);
			}

			log.verbose("  target descriptor version %s: include sap.ui5/library information", descriptorVersion);

			const sapUi5AppData = findChild(manifestAppData, "sap.ui5");
			const libraryAppData = findChild(sapUi5AppData, "library");

			// i18n:
			// - from .library/appData/manifest/sap.ui5/library/i18n
			// - from library resources (if "messagebundle.properties" exists)
			function i18n() {
				const i18nElement = findChild(libraryAppData, "i18n");
				if ( i18nElement ) {
					const i18n = i18nElement._;
					if ( i18n === "false" ) {
						return false;
					} else if ( i18n === "true" ) {
						return "messagebundle.properties";
					} else {
						return i18n;
					}
					// log.verbose("  sap.ui5/library/i18n property taken from .library appData: '%s'", library.i18n);
				} else {
					if ( libBundle.findResource("messagebundle.properties") != null ) {
						// log.verbose("  sap.ui5/library/i18n property determined from resources: '%s'", library.i18n);
						return "messagebundle.properties";
					} else {
						return false;
					}
				}
			}

			// css:
			// - from .library/appData/manifest/sap.ui5/library/css
			// - from library.js/initLibrary/noLibraryCSS
			function css() {
				const cssElement = findChild(libraryAppData, "css");
				if ( cssElement != null ) {
					const css = cssElement._;
					if ( css === "false" ) {
						log.verbose("  sap.ui5/library/css property taken from .library appData: '%s'", false);
						return false;
					}
				} else if ( libraryJSInfo.noLibraryCSS ) {
					log.verbose("  sap.ui5/library/css property extracted from library.js: '%s'", false);
					return false;
				}
			}

			// content
			// - from library.js/initLibrary/ (types|elements|controls|interfaces)
			function content() {
				const libraryJS = libraryJSInfo;
				if ( libraryJS.controls || libraryJS.elements || libraryJS.interfaces || libraryJS.types ) {
					return {
						controls: libraryJS.controls,
						elements: libraryJS.elements,
						types: libraryJS.types,
						interfaces: libraryJS.interfaces
					};
				}
			}

			return {
				i18n: i18n(),
				css: css(),
				content: content()
			};
		}

		const sapUI5 = {
			_version: sectionVersion(APP_DESCRIPTOR_V3_OTHER_SECTIONS),
			dependencies: dependencies(),
			contentDensities: contentDensities(),
			library: createLibraryMetadata()
		};

		return sapUI5;
	}

	function createSapFiori() {
		// collect registrationIds if present
		function registrationIds() {
			const ids = [];
			for (const regid of findChildren(sapFioriAppData, "registrationId")) {
				ids.push(regid._);
			}
			return ids.length > 0 ? ids : undefined;
		}

		if ( sapFioriAppData != null ) {
			return {
				_version: sectionVersion(APP_DESCRIPTOR_V3_OTHER_SECTIONS),
				registrationIds: registrationIds(),
				archeType: getChildTextContent(sapFioriAppData, "archeType", "reuseComponent")
			};
		}
	}

	function createSapPlatformABAP() {
		const sapPlatformABAPElement = findChild(manifestAppData, "sap.platform.abap");
		if ( sapPlatformABAPElement ) {
			return {
				_version: sectionVersion(APP_DESCRIPTOR_V3_OTHER_SECTIONS),
				uri: getChildTextContent(sapPlatformABAPElement, "uri")
			};
		}
	}

	function createSapPlatformHCP() {
		const sapPlatformHCPElement = findChild(manifestAppData, "sap.platform.hcp");
		if ( sapPlatformHCPElement ) {
			return {
				_version: sectionVersion(APP_DESCRIPTOR_V3_OTHER_SECTIONS),
				uri: getChildTextContent(sapPlatformHCPElement, "uri")
			};
		}
	}

	function normalizeVersion(version) {
		if ( version == null ) {
			return version;
		}
		const v = new Version(version);
		return v.major + "." + v.minor;
	}

	function getVersion(dependency) {
		const version = dependency.getVersion();
		if ( version != null ) {
			return version;
		}

		function hasName(entity) {
			return entity.metadata && entity.metadata.name === dependency.getLibraryName();
		}

		const project = libraryResource._project;
		if ( project ) {
			if ( Array.isArray(project.dependencies) ) {
				const lib = project.dependencies.find(hasName);
				if ( lib ) {
					return lib.version;
				}
			}
			if ( hasName(project) ) {
				return project.version;
			}
		}

		throw new Error(
			`Couldn't find version for library '${dependency.getLibraryName()}', project dependency missing?`);
	}

	return {
		"_version": descriptorVersion.toString(),
		"sap.app": createSapApp(),
		"sap.ui": createSapUi(),
		"sap.ui5": createSapUI5(),
		"sap.fiori": createSapFiori(),
		"sap.platform.abap": createSapPlatformABAP(),
		"sap.platform.hcp": createSapPlatformHCP()
	};
}

module.exports = function({libraryResource, resources, options}) {
	// merge options with defaults
	options = Object.assign({
		descriptorVersion: APP_DESCRIPTOR_V10,
		include3rdParty: true,
		prettyPrint: true
	}, options);

	const resourcePathPrefix = libraryResource.getPath().slice(0, -".library".length);
	const libBundle = new LibraryBundle(resourcePathPrefix, resources);

	// check whether a manifest exists already
	const manifestResource = libBundle.findResource("manifest.json");
	if ( manifestResource != null ) {
		log.info("Library manifest already exists at '%s', skipping generation", manifestResource.getPath());
		return Promise.resolve(null); // a fulfillment of null indicates that no manifest has been created
	}

	return createManifest(libraryResource, libBundle, options.descriptorVersion, options.include3rdParty).then((manifest) => {
		return new EvoResource({
			path: resourcePathPrefix + "manifest.json",
			string: JSON.stringify(manifest, null, options.prettyPrint ? "  " : undefined)
		});
	});
};
