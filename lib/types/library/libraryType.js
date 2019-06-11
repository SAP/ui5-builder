const LibraryFormatter = require("./LibraryFormatter");
const LibraryBuilder = require("./LibraryBuilder");

module.exports = {
	format: function(project) {
		return new LibraryFormatter({project}).format();
	},
	build: function({resourceCollections, tasks, project, parentLogger, buildContext}) {
		return new LibraryBuilder({resourceCollections, project, parentLogger, buildContext}).build(tasks);
	},

	// Export type classes for extensibility
	Builder: LibraryBuilder,
	Formatter: LibraryFormatter
};
