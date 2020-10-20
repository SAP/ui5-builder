/* eslint quotes: ["error", "double", { "allowTemplateLiterals": true }] */
// for consistency of write calls, we generally allow template literals
"use strict";

const path = require("path");
const terser = require("terser");
const {pd} = require("pretty-data");
const sourceMap = require("source-map");

const {isMethodCall} = require("../utils/TerserASTUtils");
const ModuleName = require("../utils/ModuleName");
const UI5ClientConstants = require("../UI5ClientConstants");
const escapePropertiesFile = require("../utils/escapePropertiesFile");

const BundleResolver = require("./Resolver");
const BundleSplitter = require("./AutoSplitter");
const {SectionType} = require("./BundleDefinition");
const BundleWriter = require("./BundleWriter");
const log = require("@ui5/logger").getLogger("lbt:bundle:Builder");

const copyrightCommentsPattern = /copyright|\(c\)(?:[0-9]+|\s+[0-9A-za-z])|released under|license|\u00a9|^@ui5-bundle-raw-include |^@ui5-bundle /i;
const sourcemapPattern = /\/\/# sourceMappingURL=data:application\/json;charset=utf-8;base64,(.+)/i;
const xmlHtmlPrePattern = /<(?:\w+:)?pre>/;

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

const UI5BundleFormat = {
	beforePreloads(outW, section) {
		outW.write(`jQuery.sap.registerPreloadedModules(`);
		outW.writeln(`{`);
		if ( section.name ) {
			outW.writeln(`"name":"${section.name}",`);
		}
		outW.writeln(`"version":"2.0",`);
		outW.writeln(`"modules":{`);
	},

	afterPreloads(outW, section) {
		outW.writeln(`}});`);
	},

	requireSync(outW, moduleName) {
		outW.writeln(`sap.ui.requireSync("${ModuleName.toRequireJSName(moduleName)}");`);
	},

	shouldDecorate(resolvedModule) {
		return resolvedModule.executes(UI5ClientConstants.MODULE__JQUERY_SAP_GLOBAL);
	},

	supportsNativeDefine() {
		return false;
	}
};

const EVOBundleFormat = {
	beforePreloads(outW, section) {
		outW.writeln(`sap.ui.require.preload({`);
	},

	afterPreloads(outW, section) {
		outW.write(`}`);
		if ( section.name ) {
			outW.write(`,"${section.name}"`);
		}
		outW.writeln(`);`);
	},

	requireSync(outW, moduleName) {
		outW.writeln(`sap.ui.requireSync("${ModuleName.toRequireJSName(moduleName)}");`);
	},

	shouldDecorate(resolvedModule) {
		return resolvedModule.executes(UI5ClientConstants.MODULE__UI5LOADER) ||
			resolvedModule.executes(UI5ClientConstants.MODULE__UI5LOADER_AUTOCONFIG) ||
			resolvedModule.executes(UI5ClientConstants.MODULE__JQUERY_SAP_GLOBAL) ||
			resolvedModule.executes(UI5ClientConstants.MODULE__SAP_UI_CORE_CORE);
	},

	supportsNativeDefine() {
		// disabled in 1.54 as the standard global names define/require are not written by the ui5loader
		return false;
	}
};

class BundleBuilder {
	constructor(pool) {
		this.pool = pool;
		this.resolver = new BundleResolver(pool);
		this.splitter = new BundleSplitter(pool, this.resolver);
		this.targetBundleFormat = null;
	}

	async createBundle(module, options) {
		await this._prepare();
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

	_prepare() {
		return Promise.all([
			// check whether the resource pool contains debug and optimized sources
			this.pool.findResource( ModuleName.getDebugName(UI5ClientConstants.MODULE__JQUERY_SAP_GLOBAL) ).
				then( () => this.optimizedSources = true, () => this.optimizedSources = false ),
			// check whether EVO modules are available. If so, use EVO APIs, else use old UI5 APIs.
			this.pool.findResource(UI5ClientConstants.EVO_MARKER_RESOURCE).
				then( () => this.targetBundleFormat = EVOBundleFormat, () => this.targetBundleFormat = UI5BundleFormat )
		]);
	}

	async _createBundle(module, options) {
		const resolvedModule = await this.resolver.resolve(module, options);
		log.verbose("  create '%s'", resolvedModule.name);

		this.options = options || {};
		this.optimize = !!this.options.optimize;

		// when decorateBootstrapModule is set to false, we don't write the optimized flag
		// and don't write the try catch wrapper
		this.shouldDecorate = this.options.decorateBootstrapModule &&
			(((this.optimizedSources && !this.options.debugMode) || this.optimize) &&
				this.targetBundleFormat.shouldDecorate(resolvedModule));
		// TODO is the following condition ok or should the availability of jquery.sap.global.js be configurable?
		this.jqglobalAvailable = !resolvedModule.containsGlobal;
		this.openModule(resolvedModule.name);

		// this.writeConfiguration(resolvedModule.configuration); // NODE-TODO configuration currently will be undefined
		this._sourceMap = new sourceMap.SourceMapGenerator({file: module.name, sourceRoot: "."});

		// create all sections in sequence
		for ( const section of resolvedModule.sections ) {
			log.verbose("    adding section%s of type %s",
				section.name ? " '" + section.name + "'" : "", section.mode);
			await this.addSection(section);
		}

		this.closeModule(resolvedModule);

		const bundleInfo = await resolvedModule.createModuleInfo(this.pool);
		bundleInfo.size = this.outW.length;

		return {
			name: module.name,
			content: this.outW.toString(),
			sourceMap: this._sourceMap.toString(),
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

	closeModule(resolvedModule) {
		if ( resolvedModule.containsCore ) {
			this.outW.ensureNewLine(); // for clarity and to avoid issues with single line comments
			this.outW.writeln(`// as this module contains the Core, we ensure that the Core has been booted`);
			this.outW.writeln(`sap.ui.getCore().boot && sap.ui.getCore().boot();`);
		}
		if ( this.shouldDecorate && this.options.addTryCatchRestartWrapper ) {
			this.outW.ensureNewLine(); // for clarity and to avoid issues with single line comments
			this.outW.writeln(`} catch(oError) {`);
			this.outW.writeln(`if (oError.name != "Restart") { throw oError; }`);
			this.outW.writeln(`}`);
		}
		this.outW.writeln(`//# sourceMappingURL=${path.basename(resolvedModule.name)}.map`);
	}

	addSection(section) {
		this.ensureRawDeclarations();

		switch (section.mode) {
		case SectionType.Provided:
			// do nothing
			return undefined; // nothing to wait for
		case SectionType.Raw:
			return this.writeRaw(section);
		case SectionType.Preload:
			return this.writePreloadFunction(section);
		case SectionType.Require:
			return this.writeRequires(section);
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
			this.outW.writeln("jQuery.sap.declare('", ModuleName.toUI5LegacyName(moduleName), "');");
			*/
			this.missingRawDeclarations.forEach( (module) => {
				// 2nd parameter set to 'false': do not create namespaces - they nevertheless would come too late
				this.outW.writeln(`jQuery.sap.declare('${ModuleName.toUI5LegacyName(module)}', false);`);
			});
			this.missingRawDeclarations = [];
		}
	}

	// TODO check that there are only JS modules contained
	async writeRaw(section) {
		// write all modules in sequence
		for ( const module of section.modules ) {
			const resource = await this.pool.findResourceWithInfo(module);
			if ( resource != null ) {
				this.outW.startSegment(module);
				this.outW.ensureNewLine();
				this.outW.writeln("//@ui5-bundle-raw-include " + module);
				await this.writeRawModule(module, resource);
				const compressedSize = this.outW.endSegment();
				log.verbose("    %s (%d,%d)", module, resource.info != null ? resource.info.size : -1, compressedSize);
				if ( section.declareRawModules ) {
					this.missingRawDeclarations.push(module);
				}
				if ( module === UI5ClientConstants.MODULE__JQUERY_SAP_GLOBAL ) {
					this.jqglobalAvailable = true;
				}
			} else {
				log.error("    couldn't find %s", module);
			}
		}
	}

	async writeRawModule(module, resource) {
		let fileContent = await resource.buffer();
		if ( /\.js$/.test(module) ) {
			const {compressedContent} = {...await this.compressJS( fileContent, resource )};
			fileContent = compressedContent;
		}
		this.outW.ensureNewLine();
		this.outW.write( fileContent );
	}

	async writePreloadFunction(section) {
		const outW = this.outW;
		const avoidLazyParsing = section.sectionDefinition.avoidLazyParsing;

		outW.ensureNewLine();

		const sequence = section.modules.slice();

		this.beforeWriteFunctionPreloadSection(sequence);
		await this.rewriteAMDModules(sequence, avoidLazyParsing);
		if ( sequence.length > 0 ) {
			this.targetBundleFormat.beforePreloads(outW, section);
			let i = 0;
			for ( const module of sequence ) {
				const resource = await this.pool.findResourceWithInfo(module);
				if ( resource != null ) {
					if ( i>0 ) {
						outW.writeln(",");
					}
					this.beforeWritePreloadModule(module, resource.info, resource);
					outW.write(`\t"${module.toString()}":`);
					outW.startSegment(module);

					await this.writePreloadModule(module, resource.info, resource, avoidLazyParsing);
					const compressedSize = outW.endSegment();
					log.verbose("    %s (%d,%d)", module,
						resource.info != null ? resource.info.size : -1, compressedSize);
					i++;
				} else {
					log.error("    couldn't find %s", module);
				}
			}

			if ( i > 0 ) {
				outW.writeln();
			}
			this.targetBundleFormat.afterPreloads(outW, section);
		}

		// this.afterWriteFunctionPreloadSection();
	}

	async compressJS(fileContent, resource, fileMap) {
		if ( this.optimize ) {
			const result = await terser.minify({
				[resource.name]: String(fileContent)
			}, {
				sourceMap: {
					content: fileMap ? fileMap.toString() : "inline",
					filename: ModuleName.getDebugName(path.basename(resource.name)),
					root: "."
				},
				warnings: false, // TODO configure?
				compress: false, // TODO configure?
				output: {
					comments: copyrightCommentsPattern,
					wrap_func_args: false
				}
				// , outFileName: resource.name
				// , outSourceMap: true
			});
			if ( result.error ) {
				throw result.error;
			}
			fileContent = result.code;
			fileMap = result.map;
			// throw new Error();
		}
		return {compressedContent: fileContent, contentMap: fileMap};
	}

	compressJSAST(ast, resource, sourceMap) {
		const result = terser.minify(ast, {
			sourceMap: {
				content: sourceMap,
				filename: path.posix.basename(resource.name),
				asObject: true,
				root: "."
			},
			warnings: false, // TODO configure?
			compress: false, // TODO configure?
			output: {
				comments: copyrightCommentsPattern,
				wrap_func_args: false
			}
		});
		if ( result.error ) {
			throw result.error;
		}
		return {compressedContent: result.code, contentMap: result.map};
	}

	async compressJSAsync(resource) {
		const content = await resource.buffer();
		return this.compressJS( content, resource );
	}

	beforeWriteFunctionPreloadSection(sequence) {
		// simple version: just sort alphabetically
		sequence.sort();
	}

	addSourceMap(contentMap, resource) {
		if (contentMap != null) {
			const map = new sourceMap.SourceMapConsumer(contentMap);
			map.eachMapping((mapping) => {
				if (mapping.source) {
					this._sourceMap.addMapping({
						generated: {
							line: this.outW.lineOffset + mapping.generatedLine,
							column: (mapping.generatedLine === 1 ? this.outW.columnOffset : 0) + mapping.generatedColumn
						},
						original: mapping.originalLine == null ? null : {
							line: mapping.originalLine,
							column: mapping.originalColumn
						},
						source: mapping.originalLine != null ? mapping.source : null,
						name: mapping.name
					});
				}
			});
		}
	}

	async rewriteAMDModules(sequence, avoidLazyParsing) {
		if ( this.options.usePredefineCalls ) {
			const outW = this.outW;

			const remaining = [];
			for ( const module of sequence ) {
				if ( /\.js$/.test(module) ) {
					// console.log("Processing " + module);
					const resource = await this.pool.findResourceWithInfo(module);
					let sourceMapContent;
					try {
						const sourceMapResource = await this.pool.findResource(`${module}.map`);
						sourceMapContent = (await sourceMapResource.buffer()).toString();
					} catch (e) {
						// No input sourcemap
					}
					let hasDebugFile = false;
					try {
						const debugResource = await this.pool.findResource(ModuleName.getDebugName(module));
						if (debugResource !== null) {
							hasDebugFile = true;
						}
					} catch (e) {
						// No input sourcemap
					}
					const code = (await resource.buffer()).toString();
					const inlineSourcemap = code.match(sourcemapPattern);
					const hasInlineSourcemap = sourceMapContent === undefined && inlineSourcemap != null;
					let resourceSourceMap = hasInlineSourcemap ? Buffer.from(inlineSourcemap[1], "base64").toString() : sourceMapContent;
					let resourceName = hasDebugFile ? ModuleName.getDebugName(module) : module;
					resourceName = path.posix.relative(path.posix.dirname(this._sourceMap._file), resourceName);
					if (resourceSourceMap != null) {
						resourceSourceMap = JSON.parse(resourceSourceMap);
						resourceSourceMap.sources[0] = path.posix.join(path.posix.dirname(resourceName), resourceSourceMap.sources[0]);
					}
					const result = terser.minify({
						[resourceName]: code
					},
					{
						parse: {},
						compress: false,
						mangle: false,
						output: {
							ast: true,
							code: !this.optimize,
							map: !this.optimize
						}
					});

					const ast = rewriteDefine(this.targetBundleFormat, result.ast, module, avoidLazyParsing);
					if ( ast ) {
						outW.startSegment(module);
						outW.ensureNewLine();

						let preloadContent = "";
						if (this.optimize) {
							const {compressedContent, contentMap} = {...this.compressJSAST(result.ast, resource, resourceSourceMap)};
							resourceSourceMap = contentMap;
							preloadContent = compressedContent;
						} else {
							resourceSourceMap = result.map;
							preloadContent = result.code;
						}

						this.addSourceMap(resourceSourceMap, resource);

						outW.write( preloadContent );
						outW.ensureNewLine();
						const compressedSize = outW.endSegment();
						log.verbose("    %s (%d,%d)", module,
							resource.info != null ? resource.info.size : -1, compressedSize);
					} else {
						// keep unprocessed modules
						remaining.push(module);
					}
				} else {
					// keep unprocessed modules
					remaining.push(module);
				}
			}

			Array.prototype.splice.apply(sequence, [0, sequence.length].concat(remaining));
		}
	}

	afterWriteFunctionPreloadSection() {
	}

	beforeWritePreloadModule(module, info, resource) {
	}

	/**
	 *
	 * @param {string} module module name
	 * @param {ModuleInfo} info
	 * @param {module:@ui5/fs.Resource} resource
	 * @param {boolean} avoidLazyParsing
	 * @returns {Promise<boolean>}
	 */
	async writePreloadModule(module, info, resource, avoidLazyParsing) {
		const outW = this.outW;

		if ( /\.js$/.test(module) && (info == null || !info.requiresTopLevelScope) ) {
			if ( avoidLazyParsing ) {
				outW.write(`(`);
			}
			outW.write(`function(){`);

			const {compressedContent, contentMap} = {...await this.compressJSAsync( resource )};

			this.addSourceMap(contentMap, resource);
			outW.write( compressedContent );
			this.exportGlobalNames(info);
			outW.ensureNewLine();
			outW.write(`}`);
			if ( avoidLazyParsing ) {
				outW.write(`)`);
			}
		} else if ( /\.js$/.test(module) /* implicitly: && info != null && info.requiresTopLevelScope */ ) {
			log.warn("**** warning: module %s requires top level scope" +
					" and can only be embedded as a string (requires 'eval')", module);
			const {compressedContent} = {...await this.compressJS( await resource.buffer(), resource )};
			outW.write( makeStringLiteral( compressedContent ) );
		} else if ( /\.html$/.test(module) ) {
			const fileContent = await resource.buffer();
			outW.write( makeStringLiteral( fileContent ) );
		} else if ( /\.json$/.test(module) ) {
			let fileContent = await resource.buffer();
			if ( this.optimize ) {
				try {
					fileContent = JSON.stringify( JSON.parse( fileContent) );
				} catch (e) {
					log.verbose("Failed to parse JSON file %s. Ignoring error, skipping compression.", module);
					log.verbose(e);
				}
			}
			outW.write(makeStringLiteral(fileContent));
		} else if ( /\.xml$/.test(module) ) {
			let fileContent = await resource.buffer();
			if ( this.optimize ) {
				// For XML we use the pretty data
				// Do not minify if XML(View) contains an <*:pre> tag,
				// because whitespace of HTML <pre> should be preserved (should only happen rarely)
				if (!xmlHtmlPrePattern.test(fileContent)) {
					fileContent = pd.xmlmin(fileContent.toString(), false);
				}
			}
			outW.write( makeStringLiteral( fileContent ) );
		} else if ( /\.properties$/.test(module) ) {
			// Since the Builder is also used when building non-project resources (e.g. dependencies)
			// *.properties files should be escaped if encoding option is specified
			const fileContent = await escapePropertiesFile(resource);

			outW.write( makeStringLiteral( fileContent ) );
		} else {
			log.error("don't know how to embed module " + module); // TODO throw?
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
			this.outW.writeln(`this.${globalName}=${globalName};`);
		});
	}

	writeRequires(section) {
		this.outW.ensureNewLine();
		section.modules.forEach( (module) => {
			this.targetBundleFormat.requireSync(this.outW, module);
		});
	}
}

// const CALL_DEFINE = ["define"];
const CALL_SAP_UI_DEFINE = ["sap", "ui", "define"];


function rewriteDefine(targetBundleFormat, ast, moduleName, avoidLazyParsing) {
	function _injectModuleNameIfNeeded(defineCall, moduleName) {
		if ( defineCall.args.length == 0 ||
				defineCall.args[0].TYPE !== "String" ) {
			defineCall.args.unshift(new terser.AST_String({
				end: null,
				start: null,
				quote: "\"",
				value: ModuleName.toRequireJSName(moduleName)
			}));
		}
	}

	// NODE_TODO
	function enforceEagerParsing(defineCall) {
		// const args = defineCall.arguments;
		// // wrap factory function to avoid lazy parsing (V8 and Chakra)
		// let iFactory = 0;
		// // skip any hard coded module name
		// if ( iFactory < args.length && args[iFactory].type === Syntax.Literal ) {
		// 	iFactory++;
		// }
		// // skip array of dependencies
		// if ( iFactory < args.length && args[iFactory].type === Syntax.ArrayExpression ) {
		// 	iFactory++;
		// }
		// // wrap factory
		// if ( iFactory < args.length && args[iFactory].type === Syntax.FunctionExpression ) {
		// 	/* NODE-TODO
		// 	Token firstToken = doc.getToken(args.getChild(iFactory).getTokenStartIndex());
		// 	Token lastToken = doc.getToken(args.getChild(iFactory).getTokenStopIndex());
		// 	if ( "function".equals(firstToken.getText())
		// 			 && "}".equals(lastToken.getText()) ) {
		// 		firstToken.setText("(" + firstToken.getText());
		// 		lastToken.setText(lastToken.getText() + ")");
		// 	} */
		// }
	}

	if ( ast instanceof terser.AST_Toplevel &&
			ast.body.length === 1 &&
			ast.body[0] instanceof terser.AST_SimpleStatement ) {
		const callStatement = ast.body[0].body;
		if ( isMethodCall(callStatement, CALL_SAP_UI_DEFINE) ) {
			// rewrite sap.ui.define to sap.ui.predefine
			if ( callStatement.expression.property === "define" ) {
				callStatement.expression.property = "predefine";
				callStatement.expression.end.value = "predefine";
			}

			_injectModuleNameIfNeeded(callStatement, moduleName);

			if ( avoidLazyParsing ) {
				enforceEagerParsing(callStatement);
			}
			// console.log("rewriting %s", module, defineCall);

			return ast;
		}
	}

	return false;
}

module.exports = BundleBuilder;
