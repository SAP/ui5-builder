const ApplicationFormatter = require("./ApplicationFormatter");
const ApplicationBuilder = require("./ApplicationBuilder");

module.exports = {
	format: function(project) {
		return new ApplicationFormatter().format(project);
	},
	build: function({resourceCollections, project, parentLogger, buildOptions}) {
		return new ApplicationBuilder({resourceCollections, project, parentLogger, buildOptions}).build();
	},

	// Export type classes for extensibility
	Builder: ApplicationBuilder,
	Formatter: ApplicationFormatter
};
