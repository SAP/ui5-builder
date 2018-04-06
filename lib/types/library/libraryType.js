const LibraryFormatter = require("./LibraryFormatter");
const LibraryBuilder = require("./LibraryBuilder");

module.exports = {
	format: function(project) {
		return new LibraryFormatter().format(project);
	},
	build: function({resourceCollections, project, parentLogger, buildOptions}) {
		return new LibraryBuilder({resourceCollections, project, parentLogger, buildOptions}).build();
	},

	// Export type classes for extensibility
	Builder: LibraryBuilder,
	Formatter: LibraryFormatter
};
