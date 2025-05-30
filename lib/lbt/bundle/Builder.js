/* eslint quotes: ["error", "double", { "allowTemplateLiterals": true }] */
// for consistency of write calls, we generally allow template literals

import path from "node:path";
import {pd} from "pretty-data";
import {parseJS, Syntax} from "../utils/parseUtils.js";
import {encode as encodeMappings, decode as decodeMappings} from "@jridgewell/sourcemap-codec";
import {isMethodCall} from "../utils/ASTUtils.js";
import {toUI5LegacyName, toRequireJSName} from "../utils/ModuleName.js";
import {
	MODULE__UI5LOADER, MODULE__UI5LOADER_AUTOCONFIG,
	MODULE__JQUERY_SAP_GLOBAL, MODULE__SAP_UI_CORE_CORE} from "../UI5ClientConstants.js";
import escapePropertiesFile from "../utils/escapePropertiesFile.js";
import BundleResolver from "./Resolver.js";
import BundleSplitter from "./AutoSplitter.js";
import {SectionType} from "./BundleDefinition.js";
import BundleWriter from "./BundleWriter.js";
import {getLogger} from "@ui5/logger";
import semver from "semver";
const log = getLogger("lbt:bundle:Builder");

const sourceMappingUrlPattern = /\/\/# sourceMappingURL=(\S+)\s*$/;
const httpPattern = /^https?:\/\//i;
const xmlHtmlPrePattern = /<(?:\w+:)?pre\b/;

const strReplacements = {
	"\r": "\\r",
	"\t": "\\t",
	"\n": "\\n",
	"'": "\\'",
	"\\": "\\\\"
};

function makeStringLiteral(str) {
	return "'" + String(str).replace(/['\r\n\t\\]/g, function(char) {
		return strReplacements[char];
	}) + "'";
}
function removeHashbang(str) {
	return str.replace(/^#!(.*)/, "");
}

function isEmptyBundle(resolvedBundle) {
	return resolvedBundle.sections.every((section) => section.modules.length === 0);
}

class BundleBuilder {
	constructor(pool, targetUi5CoreVersion, allowStringBundling) {
		this.pool = pool;
		this.resolver = new BundleResolver(pool);
		this.splitter = new BundleSplitter(pool, this.resolver);
		this.targetUi5CoreVersion = targetUi5CoreVersion;
		this.targetUi5CoreVersionMajor = undefined;
		this.allowStringBundling = allowStringBundling;
	}

	getEffectiveUi5MajorVersion() {
		if (this.targetUi5CoreVersionMajor !== undefined) {
			return this.targetUi5CoreVersionMajor;
		}

		const parsedVersion = semver.parse(this.targetUi5CoreVersion);
		if (parsedVersion) {
			this.targetUi5CoreVersionMajor = parsedVersion.major;

			// legacy-free versions include changes of the upcoming major version
			// so we should treat them the same as the next major version
			if (
				parsedVersion.prerelease.includes("legacy-free") ||
				parsedVersion.prerelease.includes("legacy-free-SNAPSHOT") // Maven snapshot version
			) {
				this.targetUi5CoreVersionMajor += 1;
			}
		} else {
			// Assume legacy version if unable to determine the version
			this.targetUi5CoreVersionMajor = null;
		}
		return this.targetUi5CoreVersionMajor;
	}

	generateAfterPreloads(section) {
		let str = `}`;
		if ( section.name ) {
			str += `,"${section.name}"`;
		}
		str += `);\n`;
		return str;
	}

	generateRequire(modules) {
		const requireCallback = this.determineRequireCallback(modules) ?? "";
		return `sap.ui.require([${
			modules.map(($) => `"${toRequireJSName($)}"`).join(",\n")
		}]${requireCallback});\n`;
	}

	determineRequireCallback(modules) {
		if (this.getEffectiveUi5MajorVersion() >= 2) {
			// Starting with UI5 2.0.0, method Core.boot does not exist anymore
			return;
		}
		const coreModuleIndex = modules.indexOf(MODULE__SAP_UI_CORE_CORE);
		if (coreModuleIndex === -1) {
			return;
		}
		return `, (${
			modules.map((m, i) => i === coreModuleIndex ? `Core` : `_m${i}`)
		}) => Core.boot?.()`;
	}

	generateRequireSync(moduleName) {
		return `sap.ui.requireSync("${toRequireJSName(moduleName)}");\n`;
	}

	executesLoaderOrCore(resolvedModule) {
		return resolvedModule.executes(MODULE__UI5LOADER) ||
			resolvedModule.executes(MODULE__UI5LOADER_AUTOCONFIG) ||
			resolvedModule.executes(MODULE__JQUERY_SAP_GLOBAL) ||
			resolvedModule.executes(MODULE__SAP_UI_CORE_CORE);
	}

	async createBundle(module, options) {
		if ( options.numberOfParts > 1 ) {
			const bundleInfos = [];
			const submodules = await this.splitter.run( module, options );
			for ( const submodule of submodules ) {
				bundleInfos.push( await this._createBundle(submodule, options) );
			}
			return bundleInfos;
		} else {
			return this._createBundle(module, options);
		}
	}

	async _createBundle(module, options) {
		const resolvedModule = await this.resolver.resolve(module);
		if ( options.skipIfEmpty && isEmptyBundle(resolvedModule) ) {
			log.verbose("  Skipping empty bundle " + module.name);
			return undefined;
		}
		log.verbose(`  Create '${resolvedModule.name}'`);

		this.options = options || {};
		this.optimize = !!this.options.optimize;
		if (this.options.sourceMap === undefined) {
			this.options.sourceMap = true;
		}

		// when decorateBootstrapModule is false,
		// we don't write the optimized flag and don't write the try catch wrapper
		this.shouldDecorate = this.options.decorateBootstrapModule &&
				this.executesLoaderOrCore(resolvedModule);
		// TODO is the following condition ok or should the availability of jquery.sap.global.js be configurable?
		this.jqglobalAvailable = !resolvedModule.containsGlobal;
		this.openModule(resolvedModule.name);

		this._sourceMap = {
			version: 3,
			file: path.posix.basename(resolvedModule.name),
			sections: [],
		};
		this._bundleName = resolvedModule.name;
		this._inlineContentCounter = 0;

		let bundleInfos = [];
		// create all sections in sequence
		for ( const section of resolvedModule.sections ) {
			log.verbose(`    Adding section${section.name ? " '" + section.name + "'" : ""} of type ${section.mode}`);
			if ( section.mode === SectionType.BundleInfo ) {
				bundleInfos.push(section);
			} else {
				if ( bundleInfos.length > 0 ) {
					await this.writeBundleInfos(bundleInfos);
					bundleInfos = [];
				}
				await this.addSection(section);
			}
		}
		if ( bundleInfos.length > 0 ) {
			await this.writeBundleInfos(bundleInfos);
			bundleInfos = [];
		}

		this.closeModule(resolvedModule);

		const bundleInfo = await resolvedModule.createModuleInfo(this.pool, this.allowStringBundling);
		bundleInfo.size = this.outW.length;

		return {
			name: module.name,
			content: this.outW.toString(),
			sourceMap: this.options.sourceMap ? JSON.stringify(this._sourceMap) : null,
			bundleInfo: bundleInfo
		};
	}

	openModule(module) {
		this.outW = new BundleWriter();
		this.missingRawDeclarations = [];

		this.outW.writeln("//@ui5-bundle " + module);
		if ( this.shouldDecorate ) {
			this.outW.writeln(`window["sap-ui-optimized"] = true;`);
			if ( this.options.addTryCatchRestartWrapper ) {
				this.outW.writeln(`try {`);
			}
		}
	}

	writeWithSourceMap(content) {
		const transientSourceName =
			`${path.posix.basename(this._bundleName)}?bundle-code-${this._inlineContentCounter++}`;
		const sourceMap = createTransientSourceMap({
			moduleName: transientSourceName,
			moduleContent: content,
			includeContent: true
		});
		this.addSourceMap(this._bundleName, sourceMap);
		this.outW.write(content);
		this.outW.ensureNewLine();
	}

	closeModule(resolvedModule) {
		if ( resolvedModule.containsCoreSync ) {
			if ( this.getEffectiveUi5MajorVersion() >= 2 ) {
				throw new Error("Requiring sap/ui/core/Core synchronously is not supported as of UI5 Version 2");
			}
			this.outW.ensureNewLine(); // for clarity and to avoid issues with single line comments
			this.writeWithSourceMap(
				`// as this module contains the Core, we ensure that the Core has been booted\n` +
				`sap.ui.getCore?.().boot?.();`);
		}
		if ( this.shouldDecorate && this.options.addTryCatchRestartWrapper ) {
			this.outW.ensureNewLine(); // for clarity and to avoid issues with single line comments
			this.writeWithSourceMap(
				`} catch(oError) {\n` +
				`if (oError.name != "Restart") { throw oError; }\n` +
				`}`);
		}
		if (this.options.sourceMap) {
			this.outW.writeln(`//# sourceMappingURL=${path.posix.basename(resolvedModule.name)}.map`);
		}
	}

	async addSection(section) {
		this.ensureRawDeclarations();

		switch (section.mode) {
		case SectionType.Provided:
			// do nothing
			return undefined; // nothing to wait for
		case SectionType.Raw:
			return await this.writeRaw(section);
		case SectionType.Preload:
			return await this.writePreloadFunction(section);
		case SectionType.BundleInfo:
			return await this.writeBundleInfos([section]);
		case SectionType.Require:
			return await this.writeRequires(section);
		case SectionType.DepCache:
			return await this.writeDepCache(section);
		default:
			throw new Error("unknown section mode " + section.mode);
		}
	}

	ensureRawDeclarations() {
		if ( this.missingRawDeclarations.length && this.jqglobalAvailable ) {
			this.outW.ensureNewLine(); // for clarity and to avoid issues with single line comments
			/* NODE-TODO, moduleName is not defined
				It should contain the name of the module which is currently build (1st parameter of _createBundle).
				But when the ui5loader is present, declareRawModules should be forced to false anyhow.
			this.outW.writeln("jQuery.sap.declare('", toUI5LegacyName(moduleName), "');");
			*/
			this.missingRawDeclarations.forEach( (module) => {
				// 2nd parameter set to 'false': do not create namespaces - they nevertheless would come too late
				this.outW.writeln(`jQuery.sap.declare('${toUI5LegacyName(module)}', false);`);
			});
			this.missingRawDeclarations = [];
		}
	}

	// TODO check that there are only JS modules contained
	async writeRaw(section) {
		// write all modules in sequence
		for ( const moduleName of section.modules ) {
			const resource = await this.pool.findResourceWithInfo(moduleName);
			if ( resource != null ) {
				this.outW.startSegment(moduleName);
				this.outW.ensureNewLine();
				this.outW.writeln("//@ui5-bundle-raw-include " + moduleName);
				await this.writeRawModule(moduleName, resource);
				const compressedSize = this.outW.endSegment();
				log.verbose(`    ${moduleName} (${resource.info != null ? resource.info.size : -1},${compressedSize})`);
				if ( section.declareRawModules ) {
					this.missingRawDeclarations.push(moduleName);
				}
				if ( moduleName === MODULE__JQUERY_SAP_GLOBAL ) {
					this.jqglobalAvailable = true;
				}
			} else {
				log.error(`    Could not find module ${moduleName}`);
			}
		}
	}

	async writeRawModule(moduleName, resource) {
		this.outW.ensureNewLine();
		let moduleContent = (await resource.buffer()).toString();
		moduleContent = removeHashbang(moduleContent);
		if (this.options.sourceMap) {
			let moduleSourceMap;
			({moduleContent, moduleSourceMap} =
				await this.getSourceMapForModule({
					moduleName,
					moduleContent,
					resourcePath: resource.getPath()
				}));
			this.addSourceMap(moduleName, moduleSourceMap);
		}
		this.outW.write(moduleContent);
		this.outW.ensureNewLine();
	}

	async writePreloadFunction(section) {
		const outW = this.outW;

		outW.ensureNewLine();

		const sequence = section.modules.slice();

		this.beforeWriteFunctionPreloadSection(sequence);

		await this.rewriteAMDModules(sequence);
		if ( sequence.length > 0 ) {
			this.writeWithSourceMap(`sap.ui.require.preload({\n`);
			let i = 0;
			for ( const module of sequence ) {
				const resource = await this.pool.findResourceWithInfo(module);
				if ( resource != null ) {
					if ( i>0 ) {
						outW.writeln(",");
					}
					outW.write(`\t"${module.toString()}":`);
					outW.startSegment(module);
					await this.writePreloadModule(module, resource.info, resource);
					const compressedSize = outW.endSegment();
					log.verbose(`    ${module} (${resource.info != null ? resource.info.size : -1},${compressedSize})`);
					i++;
				} else {
					log.error(`    Could not find module ${module}`);
				}
			}

			if ( i > 0 ) {
				outW.writeln();
			}
			outW.write(this.generateAfterPreloads(section));
		}
	}

	beforeWriteFunctionPreloadSection(sequence) {
		// simple version: just sort alphabetically
		sequence.sort();
	}

	addSourceMap(moduleName, map) {
		if (!map) {
			throw new Error("No source map provided");
		}

		// Reminder on the structure of line-segments in the map:
		// [generatedCodeColumn, sourceIndex, sourceCodeLine, sourceCodeColumn, nameIndex]
		if (map.mappings.startsWith(";")) {
			// If first line is not already mapped (typical for comments or parentheses), add a mapping to
			// make sure that dev-tools (especially Chrome's) don't choose the end of the preceding module
			// when the user tries to set a breakpoint from the bundle file
			map.mappings = "AAAA" + map.mappings;
		} else if (this.outW.columnOffset === 0 && !map.mappings.startsWith("A")) {
			// If first column of the first line is not already mapped, add a mapping for the same reason as above.
			// This is typical for transpiled code, where there is a bunch of generated code at the beginning that
			// can't be mapped to the original source
			if (map.mappings) {
				map.mappings = "AAAA," + map.mappings;
			} else {
				// If there are no existing mappings (e.g. if the file is empty or only comments),
				// make sure to still define a single mapping
				map.mappings = "AAAA";
			}
		}

		map.sourceRoot = path.posix.relative(
			path.posix.dirname(this._bundleName), path.posix.dirname(moduleName));

		this._sourceMap.sections.push({
			offset: {
				line: this.outW.lineOffset,
				column: this.outW.columnOffset
			},
			map
		});
	}

	async rewriteAMDModules(sequence) {
		const outW = this.outW;

		const remaining = [];
		for ( const moduleName of sequence ) {
			if ( /\.js$/.test(moduleName) ) {
				const resource = await this.pool.findResourceWithInfo(moduleName);

				if (resource.info?.requiresTopLevelScope && !this.allowStringBundling) {
					this.logStringBundlingError(moduleName);
					continue;
				}

				let moduleContent = (await resource.buffer()).toString();
				moduleContent = removeHashbang(moduleContent);
				let moduleSourceMap;
				if (this.options.sourceMap) {
					({moduleContent, moduleSourceMap} =
						await this.getSourceMapForModule({
							moduleName,
							moduleContent,
							resourcePath: resource.getPath()
						}));
				}

				const rewriteRes = await rewriteDefine({
					moduleName, moduleContent, moduleSourceMap
				});
				if (rewriteRes) {
					const {moduleContent, moduleSourceMap} = rewriteRes;
					outW.startSegment(moduleName);
					outW.ensureNewLine();
					if (moduleSourceMap) {
						this.addSourceMap(moduleName, moduleSourceMap);
					}
					outW.write(moduleContent);
					outW.ensureNewLine();
					const compressedSize = outW.endSegment();
					log.verbose(
						`    ${moduleName} (${resource.info != null ? resource.info.size : -1},${compressedSize})`);
				} else {
					// keep unprocessed modules
					remaining.push(moduleName);
				}
			} else {
				// keep unprocessed modules
				remaining.push(moduleName);
			}
		}

		Array.prototype.splice.apply(sequence, [0, sequence.length].concat(remaining));
	}

	/**
	 *
	 * @param {string} moduleName module name
	 * @param {ModuleInfo} info
	 * @param {@ui5/fs/Resource} resource
	 * @returns {Promise<boolean>}
	 */
	async writePreloadModule(moduleName, info, resource) {
		const outW = this.outW;

		if ( /\.js$/.test(moduleName) && (info == null || !info.requiresTopLevelScope) ) {
			outW.writeln(`function(){`);
			// The module should be written to a new line in order for dev-tools to map breakpoints to it
			outW.ensureNewLine();
			let moduleContent = (await resource.buffer()).toString();
			moduleContent = removeHashbang(moduleContent);
			if (this.options.sourceMap) {
				let moduleSourceMap;
				({moduleContent, moduleSourceMap} =
					await this.getSourceMapForModule({
						moduleName,
						moduleContent,
						resourcePath: resource.getPath()
					}));

				this.addSourceMap(moduleName, moduleSourceMap);
			}
			outW.write(moduleContent);
			this.exportGlobalNames(info);
			outW.ensureNewLine();
			outW.write(`}`);
		} else if ( /\.js$/.test(moduleName) /* implicitly: && info != null && info.requiresTopLevelScope */ ) {
			log.warn(
				`Module ${moduleName} requires top level scope and can only be embedded as a string (requires 'eval')`);
			let moduleContent = (await resource.buffer()).toString();
			moduleContent = removeHashbang(moduleContent);
			if (this.options.sourceMap) {
				// We are actually not interested in the source map this module might contain,
				// but we should make sure to remove any "sourceMappingURL" from the module content before
				// writing it to the bundle. Otherwise browser dev-tools might create unnecessary
				// (and likely incorrect) requests for any referenced .map files
				({moduleContent} =
					await this.getSourceMapForModule({
						moduleName,
						moduleContent,
						resourcePath: resource.getPath()
					}));
			}
			outW.write( makeStringLiteral(moduleContent) );
		} else if ( /\.html$/.test(moduleName) ) {
			const fileContent = (await resource.buffer()).toString();
			outW.write( makeStringLiteral( fileContent ) );
		} else if ( /\.json$/.test(moduleName) ) {
			let fileContent = (await resource.buffer()).toString();
			if ( this.optimize ) {
				try {
					fileContent = JSON.stringify( JSON.parse( fileContent) );
				} catch (e) {
					log.verbose(`Failed to parse JSON file ${moduleName}. Ignoring error, skipping compression.`);
					log.verbose(e);
				}
			}
			outW.write(makeStringLiteral(fileContent));
		} else if ( /\.xml$/.test(moduleName) ) {
			let fileContent = (await resource.buffer()).toString();
			if ( this.optimize ) {
				// For XML we use the pretty data
				// Do not minify if XML(View) contains an <*:pre> tag,
				// because whitespace of HTML <pre> should be preserved (should only happen rarely)
				if (!xmlHtmlPrePattern.test(fileContent)) {
					fileContent = pd.xmlmin(fileContent, false);
				}
			}
			outW.write( makeStringLiteral( fileContent ) );
		} else if ( /\.properties$/.test(moduleName) ) {
			// Since the Builder is also used when building non-project resources (e.g. dependencies)
			// *.properties files should be escaped if encoding option is specified
			const fileContent = await escapePropertiesFile(resource);

			outW.write( makeStringLiteral( fileContent ) );
		} else {
			log.error("Don't know how to embed module " + moduleName); // TODO throw?
		}

		return true;
	}

	/**
	 * Create exports for globals
	 *
	 * @param {ModuleInfo} info
	 */
	exportGlobalNames(info) {
		if ( !info || !info.exposedGlobals || !info.exposedGlobals.length ) {
			return;
		}
		this.outW.ensureNewLine();
		info.exposedGlobals.forEach( (globalName) => {
			// Note: globalName can be assumed to be a valid identifier as it is used as variable name anyhow
			this.writeWithSourceMap(`this.${globalName}=${globalName};\n`);
		});
	}

	logStringBundlingError(moduleName) {
		log.error(
			"Module " + moduleName + " requires top level scope and can only be embedded as a string " +
			"(requires 'eval'), which is not supported with specVersion 4.0 and higher. " +
			"For more information, see the UI5 Tooling documentation " +
			"https://sap.github.io/ui5-tooling/stable/pages/Builder/#javascript-files-requiring-top-level-scope");
	}

	async checkForStringBundling(moduleName) {
		if (!this.allowStringBundling && /\.js$/.test(moduleName)) {
			const resource = await this.pool.findResourceWithInfo(moduleName);
			if (resource.info?.requiresTopLevelScope) {
				this.logStringBundlingError(moduleName);
				return null;
			}
		}
		return moduleName;
	}

	async writeBundleInfos(sections) {
		this.outW.ensureNewLine();

		let bundleInfoStr = "";
		if ( sections.length > 0 ) {
			bundleInfoStr = "sap.ui.loader.config({bundlesUI5:{\n";
			let initial = true;
			for (let idx = 0; idx < sections.length; idx++) {
				const section = sections[idx];

				// Remove modules requiring string bundling
				let modules = await Promise.all(section.modules.map(this.checkForStringBundling.bind(this)));
				modules = modules.filter(($) => $) || [];

				if (!initial) {
					bundleInfoStr += ",\n";
				} else {
					initial = false;
				}

				if (!section.name) {
					throw new Error(`A 'bundleInfo' section is missing the mandatory 'name' property.` );
				}
				if (!path.extname(section.name)) {
					log.warn(`BundleInfo section name '${section.name}' is missing a file extension. ` +
						`The info might not work as expected. ` +
						`The name must match the bundle filename (incl. extension such as '.js')`);
				}
				bundleInfoStr += `"${section.name}":[${modules.map(makeStringLiteral).join(",")}]`;
			}
			bundleInfoStr += "\n}});\n";

			this.writeWithSourceMap(bundleInfoStr);
		}
	}

	writeRequires(section) {
		if (section.modules.length === 0) {
			return;
		}
		this.outW.ensureNewLine();
		if (section.async === false) {
			section.modules.forEach( (module) => {
				this.writeWithSourceMap(this.generateRequireSync(module));
			});
		} else {
			this.writeWithSourceMap(this.generateRequire(section.modules));
		}
	}

	// When AutoSplit is enabled for depCache, we need to ensure that modules
	// are not duplicated across files. This might happen due to the filters provided.
	// So, certain modules that are included in depCache could be dependencies of another
	// module in the next file. This will also duplicate its dependency definition if we do not filter.
	#depCacheSet = new Set();
	async writeDepCache(section) {
		let hasDepCache = false;

		const sequence = section.modules.slice().sort();

		if (sequence.length > 0) {
			for (const module of sequence) {
				if (this.#depCacheSet.has(module)) {
					continue;
				}

				this.#depCacheSet.add(module);
				let resource = null;
				try {
					resource = await this.pool.findResourceWithInfo(module);
				} catch {
					log.error(`    couldn't find ${module}`);
				}

				if (resource != null) {
					const deps = resource.info.dependencies.filter(
						(dep) =>
							!resource.info.isConditionalDependency(dep) &&
							!resource.info.isImplicitDependency(dep)
					);
					if (deps.length > 0) {
						if (!hasDepCache) {
							hasDepCache = true;
							this.outW.ensureNewLine();
							this.outW.writeln(`sap.ui.loader.config({depCacheUI5:{`);
						}

						this.outW.writeln(
							`"${module}": [${deps.map((dep) => `"${dep}"`).join(",")}],`
						);
					} else {
						log.verbose(`    skipped ${module}, no dependencies`);
					}
				}
			}

			if (hasDepCache) {
				this.outW.writeln(`}});`);
			}
		}
	}

	async getSourceMapForModule({moduleName, moduleContent, resourcePath}) {
		let moduleSourceMap = null;
		let newModuleContent = moduleContent;

		const sourceMapUrlMatch = moduleContent.match(sourceMappingUrlPattern);
		if (sourceMapUrlMatch) {
			const sourceMapUrl = sourceMapUrlMatch[1];
			log.silly(`Found source map reference in content of module ${moduleName}: ${sourceMapUrl}`);

			// Strip sourceMappingURL from module code to be bundled
			// It has no effect and might be cause for confusion
			newModuleContent = moduleContent.replace(sourceMappingUrlPattern, "");

			if (sourceMapUrl) {
				if (sourceMapUrl.startsWith("data:")) {
					// Data-URI indicates an inline source map
					const expectedTypeAndEncoding = "data:application/json;charset=utf-8;base64,";
					if (sourceMapUrl.startsWith(expectedTypeAndEncoding)) {
						const base64Content = sourceMapUrl.slice(expectedTypeAndEncoding.length);
						moduleSourceMap = Buffer.from(base64Content, "base64").toString();
					} else {
						log.warn(
							`Source map reference in module ${moduleName} is a data URI but has an unexpected` +
							`encoding: ${sourceMapUrl}. Expected it to start with ` +
							`"data:application/json;charset=utf-8;base64,"`);
					}
				} else if (httpPattern.test(sourceMapUrl)) {
					log.warn(`Source map reference in module ${moduleName} is an absolute URL. ` +
						`Currently, only relative URLs are supported.`);
				} else if (path.posix.isAbsolute(sourceMapUrl)) {
					log.warn(`Source map reference in module ${moduleName} is an absolute path. ` +
						`Currently, only relative paths are supported.`);
				} else {
					const sourceMapPath = path.posix.join(path.posix.dirname(moduleName), sourceMapUrl);

					try {
						const sourceMapResource = await this.pool.findResource(sourceMapPath);
						moduleSourceMap = (await sourceMapResource.buffer()).toString();
					} catch (e) {
						// No input source map
						log.warn(`Unable to read source map for module ${moduleName}: ${e.message}`);
					}
				}
			}
		} else {
			const sourceMapFileCandidate = resourcePath.slice("/resources/".length) + ".map";
			log.silly(`Could not find a sourceMappingURL reference in content of module ${moduleName}. ` +
				`Attempting to find a source map resource based on the module's path: ${sourceMapFileCandidate}`);
			try {
				const sourceMapResource = await this.pool.findResource(sourceMapFileCandidate);
				moduleSourceMap = (await sourceMapResource.buffer()).toString();
			} catch (e) {
				// No input source map
				log.silly(`Could not find a source map for module ${moduleName}: ${e.message}`);
			}
		}


		if (moduleSourceMap) {
			moduleSourceMap = JSON.parse(moduleSourceMap);

			// Check for index map, which is currently not supported
			if (Array.isArray(moduleSourceMap.sections)) {
				log.warn(
					`Module ${moduleName} references an index source map which is currently not supported. ` +
					`A transient source map will be created instead...`
				);
				moduleSourceMap = createTransientSourceMap({
					moduleName: path.posix.basename(resourcePath),
					moduleContent
				});
			}
		} else {
			log.verbose(`No source map available for module ${moduleName}. Creating transient source map...`);
			moduleSourceMap = createTransientSourceMap({
				moduleName: path.posix.basename(resourcePath),
				moduleContent
			});
		}

		return {
			moduleSourceMap,
			moduleContent: newModuleContent
		};
	}
}

const CALL_SAP_UI_DEFINE = ["sap", "ui", "define"];

/*
 * @param {object} parameters
 * @param {string} parameters.moduleName
 * @param {string} parameters.moduleContent
 * @param {object} [parameters.moduleSourceMap]
 * @returns {Promise<object|null>} Object containing <code>moduleContent</code> and
 * 	<code>moduleSourceMap</code> (if one was provided) or <code>null</code> if no rewrite was applicable
 */
async function rewriteDefine({moduleName, moduleContent, moduleSourceMap}) {
	let ast;
	try {
		ast = parseJS(moduleContent, {range: true});
	} catch (e) {
		log.error(`Error while parsing ${moduleName}: ${e.message}`);
		log.verbose(e.stack);
		return {};
	}

	if ( ast.type === Syntax.Program &&
			ast.body.length === 1 && ast.body[0].type === Syntax.ExpressionStatement &&
			isMethodCall(ast.body[0].expression, CALL_SAP_UI_DEFINE) ) {
		const changes = [];
		const defineCall = ast.body[0].expression;

		// Inject module name if missing
		if ( defineCall.arguments.length == 0 ||
			![Syntax.Literal, Syntax.TemplateLiteral].includes(defineCall.arguments[0].type)) {
			let value = `"${toRequireJSName(moduleName)}"`;
			let index;

			if (defineCall.arguments.length == 0) {
				// asterisk marks the index: sap.ui.define(*)
				index = defineCall.range[1] - 1;
			} else {
				// asterisk marks the index: sap.ui.define(*argument1)
				index = defineCall.arguments[0].range[0];
				value += ", ";
			}

			changes.push({
				index,
				value
			});
		}

		// rewrite sap.ui.define to sap.ui.predefine
		if ( defineCall.callee.type === Syntax.MemberExpression &&
				defineCall.callee.property.type === Syntax.Identifier &&
				defineCall.callee.property.name === "define" ) {
			changes.push({
				// asterisk marks the index: sap.ui.*define()
				index: defineCall.callee.property.range[0],
				value: "pre"
			});
		}

		return transform(changes, moduleContent, moduleSourceMap);
	}

	return null;
}

/*
 * @param {object[]} changes Changes that should be applied to the code
 * @param {string} moduleContent Code to transform
 * @param {object} [moduleSourceMap] Optional source map that should be aligned with the content change
 * @returns {Promise<object>} Object containing <code>moduleContent</code> and
 * 								<code>moduleSourceMap</code> (if one was provided)
 */
async function transform(changes, moduleContent, moduleSourceMap) {
	const mappingChanges = [];

	const array = Array.from(moduleContent);
	// No sorting needed as changes are added in correct (reverse) order
	changes.forEach((change) => {
		if (moduleSourceMap) {
			// Compute line and column for given index to re-align source map with inserted characters
			const precedingCode = array.slice(0, change.index);

			const line = precedingCode.reduce((lineCount, char) => {
				if (char === "\n") {
					lineCount++;
				}
				return lineCount;
			}, 0);
			const lineStartIndex = precedingCode.lastIndexOf("\n") + 1;
			const column = change.index - lineStartIndex;

			// Source map re-alignment needs to be done from front to back
			mappingChanges.unshift({
				line,
				column,
				columnDiff: change.value.length
			});
		}

		// Apply modification
		array.splice(
			change.index,
			0,
			change.value
		);
	});
	const transformedCode = array.join("");

	if (moduleSourceMap) {
		const mappings = decodeMappings(moduleSourceMap.mappings);
		mappingChanges.forEach((mappingChange) => {
			const lineMapping = mappings[mappingChange.line];
			if (!lineMapping) {
				// No mapping available that could be transformed
				return;
			}
			// Mapping structure:
			// [generatedCodeColumn, sourceIndex, sourceCodeLine, sourceCodeColumn, nameIndex]
			lineMapping.forEach((mapping) => {
				if (mapping[0] > mappingChange.column) {
					// All column mappings for the generated code after any change
					// need to be moved by the amount of inserted characters
					mapping[0] = mapping[0] + mappingChange.columnDiff;
				}
			});
		});

		moduleSourceMap.mappings = encodeMappings(mappings);

		// No need for file information in source map since the bundled code does not exist in any file anyways
		delete moduleSourceMap.file;
	}

	return {
		moduleContent: transformedCode,
		moduleSourceMap
	};
}

function createTransientSourceMap({moduleName, moduleContent, includeContent = false}) {
	const sourceMap = {
		version: 3,
		names: [],
		sources: [moduleName],
		// TODO: check whether moduleContent.match() with \n is better w.r.t performance/memory usage
		mappings: encodeMappings(moduleContent.split("\n").map((line, i) => {
			return [[0, 0, i, 0]];
		}))
	};
	if (includeContent) {
		sourceMap.sourcesContent = [moduleContent];
	}
	return sourceMap;
}

export default BundleBuilder;

export const __localFunctions__ = (process.env.NODE_ENV === "test") ?
	{rewriteDefine, createTransientSourceMap} : undefined;
