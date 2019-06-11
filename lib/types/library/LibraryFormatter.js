const log = require("@ui5/logger").getLogger("types:library:LibraryFormatter");
const path = require("path");
const fs = require("graceful-fs");
const {promisify} = require("util");
const readFile = promisify(fs.readFile);
const glob = require("globby");
const AbstractUi5Formatter = require("../AbstractUi5Formatter");


class LibraryFormatter extends AbstractUi5Formatter {
	/**
	 * Formats and validates the project
  	 *
	 * @returns {Promise}
	 */
	async format() {
		const project = this._project;
		await this.validate();

		log.verbose("Formatting library project %s...", project.metadata.name);
		project.resources.pathMappings = {
			"/resources/": project.resources.configuration.paths.src
		};

		if (project.resources.configuration.paths.test) {
			// Directory 'test' is somewhat optional for libraries
			project.resources.pathMappings["/test-resources/"] = project.resources.configuration.paths.test;
		} else {
			log.verbose(`Ignoring 'test' directory for project ${project.metadata.name}.` +
				"Either no setting was provided or the path not found.");
		}

		try {
			project.metadata.namespace = await this.getNamespace();
		} catch (err) {
			// Catch error because namespace is optional
			// TODO 2.0: Make namespace mandatory and just let the error throw
			log.warn(err.message);
		}

		try {
			project.metadata.copyright = await this.getCopyright();
		} catch (err) {
			// Catch error because copyright is optional
			// TODO 2.0: Make copyright mandatory and just let the error throw
			log.verbose(err.message);
		}
	}

	/**
	 * Returns the base *source* path of the project. Runtime resources like manifest.json are expected
	 * to be located inside this path.
	 *
	 * @param {boolean} [posix] whether to return a POSIX path
	 * @returns {string} Base source path of the project
	 */
	getSourceBasePath(posix) {
		let p = path;
		if (posix) {
			p = path.posix;
		}
		return p.join(this._project.path, this._project.resources.pathMappings["/resources/"]);
	}

	/**
	 * Determine library namespace by checking manifest.json with fallback to .library.
	 * Any maven placeholders are resolved from the projects pom.xml
	 *
	 * @returns {string} Namespace of the project
	 * @throws {Error} if namespace can not be determined
	 */
	async getNamespace() {
		let libraryId;
		let realNamspacePath;
		try {
			const {content: manifest, fsPath} = await this.getManifest();
			// check for a proper sap.app/id in manifest.json to determine namespace
			if (manifest["sap.app"] && manifest["sap.app"].id) {
				libraryId = manifest["sap.app"] && manifest["sap.app"].id;
				realNamspacePath = path.dirname(fsPath);
			} else {
				log.verbose(
					`No "sap.app" ID configuration found in manifest.json of project ${this._project.metadata.name}`);
			}
		} catch (err) {
			log.verbose(`Namespace resolution from manifest.json failed for project ` +
				`${this._project.metadata.name}: ${err.message}`);
			log.verbose(`Falling back to .library file...`);
		}

		if (!libraryId) {
			try {
				const {content: dotLibrary, fsPath} = await this.getDotLibrary();
				if (dotLibrary && dotLibrary.library && dotLibrary.library.name) {
					libraryId = dotLibrary.library.name;
					realNamspacePath = path.dirname(fsPath);
				} else {
					throw new Error(
						`No library name found in .library of project ${this._project.metadata.name}`);
				}
			} catch (err) {
				throw new Error(`Namespace resolution from .library failed for project ` +
					`${this._project.metadata.name}: ${err.message}`);
			}
		}

		if (this.hasMavenPlaceholder(libraryId)) {
			try {
				libraryId = await this.resolveMavenPlaceholder(libraryId);
			} catch (err) {
				throw new Error(
					`Failed to resolve namespace maven placeholder of project ` +
					`${this._project.metadata.name}: ${err.message}`);
			}
		}

		const namespace = libraryId.replace(/\./g, "/");
		const posixBasePath = this.getSourceBasePath(true);
		// Transform path to POSIX
		const posixNamespacePath = path.posix.normalize(realNamspacePath);
		const basePathPrefixRegExp = new RegExp(`^${posixBasePath}`);
		const namespacePath = posixNamespacePath.replace(basePathPrefixRegExp, "");
		if (namespacePath !== namespace) {
			throw new Error(
				`Detected namespace "${namespace}" does not match detected directory ` +
				`structure "${namespacePath}" for project ${this._project.metadata.name}`);
		}

		log.verbose(`Namespace of project ${this._project.metadata.name} is ${namespace}`);
		return namespace;
	}

	/**
	 * Determines library copyright from given project configuration with fallback to .library.
	 *
	 * @returns {string} Copyright of the project
	 * @throws {Error} if copyright can not be determined
	 */
	async getCopyright() {
		if (this._project.metadata.copyright) {
			return this._project.metadata.copyright;
		}
		// If no copyright replacement was provided by ui5.yaml,
		// check if the .library file has a valid copyright replacement
		const dotLibrary = await this.getDotLibrary();
		if (dotLibrary && dotLibrary.library && dotLibrary.library.copyright) {
			log.verbose(`Using copyright from .library for project ${this._project.metadata.name}...`);
			return dotLibrary.library.copyright;
		} else {
			throw new Error(`No copyright configuration found in .library ` +
				`of project ${this._project.metadata.name}`);
		}
	}

	/**
	 * Reads the projects manifest.json
	 *
	 * @returns {Promise<Object>} resolves with an object containing the <code>content</code> (as JSON) and
	 * 							<code>fsPath</code> (as string) of the manifest.json file
	 */
	async getManifest() {
		if (this._pManifest) {
			return this._pManifest;
		}
		const basePath = this.getSourceBasePath();
		return this._pManifest = glob("**/manifest.json", {
			cwd: basePath,
			followSymlinkedDirectories: false
		}).then(async (manifestResources) => {
			if (!manifestResources.length) {
				throw new Error(`Could not find manifest.json for project ${this._project.metadata.name}`);
			}
			if (manifestResources.length > 1) {
				throw new Error(`Found multiple (${manifestResources.length}) manifest.json files ` +
					`for project ${this._project.metadata.name}`);
			}
			const fsPath = path.join(basePath, manifestResources[0]);
			try {
				const content = await readFile(fsPath);
				return {
					content: JSON.parse(content),
					fsPath
				};
			} catch (err) {
				throw new Error(
					`Failed to read manifest.json for project ${this._project.metadata.name}: ${err.message}`);
			}
		});
	}

	/**
	 * Reads the .library file
	 *
	 * @returns {Promise<Object>} resolves with an object containing the <code>content</code> (as JSON) and
	 * 							<code>fsPath</code> (as string) of the .library file
	 */
	async getDotLibrary() {
		if (this._pDotLibrary) {
			return this._pDotLibrary;
		}
		const basePath = this.getSourceBasePath();
		return this._pDotLibrary = glob("**/.library", {
			cwd: basePath,
			followSymlinkedDirectories: false
		}).then(async (dotLibraryResources) => {
			if (!dotLibraryResources.length) {
				throw new Error(`Could not find .library file for project ${this._project.metadata.name}`);
			}
			if (dotLibraryResources.length > 1) {
				throw new Error(`Found multiple (${dotLibraryResources.length}) .library files ` +
					`for project ${this._project.metadata.name}`);
			}
			const fsPath = path.join(basePath, dotLibraryResources[0]);
			const content = await readFile(fsPath);
			const xml2js = require("xml2js");
			const parser = new xml2js.Parser({
				explicitArray: false,
				ignoreAttrs: true
			});
			const readXML = promisify(parser.parseString);
			const contentJson = await readXML(content);
			return {
				content: contentJson,
				fsPath
			};
		});
	}

	/**
	 * Validates the project
	 *
	 * @returns {Promise} resolves if successfully validated
	 * @throws {Error} if validation fails
	 */
	validate() {
		const project = this._project;
		return Promise.resolve().then(() => {
			if (!project) {
				throw new Error("Project is undefined");
			} else if (!project.metadata || !project.metadata.name) {
				throw new Error(`"metadata.name" configuration is missing for project ${project.id}`);
			} else if (!project.type) {
				throw new Error(`"type" configuration is missing for project ${project.id}`);
			} else if (project.version === undefined) {
				throw new Error(`"version" is missing for project ${project.id}`);
			}
			if (!project.resources) {
				project.resources = {};
			}
			if (!project.resources.configuration) {
				project.resources.configuration = {};
			}
			if (!project.resources.configuration.paths) {
				project.resources.configuration.paths = {};
			}
			if (!project.resources.configuration.paths.src) {
				project.resources.configuration.paths.src = "src";
			}
			if (!project.resources.configuration.paths.test) {
				project.resources.configuration.paths.test = "test";
			}

			const absoluteSrcPath = path.join(project.path, project.resources.configuration.paths.src);
			const absoluteTestPath = path.join(project.path, project.resources.configuration.paths.test);
			return Promise.all([
				this.dirExists(absoluteSrcPath).then(function(bExists) {
					if (!bExists) {
						throw new Error(`Could not find source directory of project ${project.id}: ` +
							`${absoluteSrcPath}`);
					}
				}),
				this.dirExists(absoluteTestPath).then(function(bExists) {
					if (!bExists) {
						log.verbose(`Could not find (optional) test directory of project ${project.id}: ` +
							`${absoluteSrcPath}`);
						// Current signal to following consumers that "test" is not available is null
						project.resources.configuration.paths.test = null;
					}
				})
			]);
		});
	}
}

module.exports = LibraryFormatter;
