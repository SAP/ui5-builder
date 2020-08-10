const test = require("ava");

const ThemeLibraryBuilder = require("../../../../lib/types/themeLibrary/ThemeLibraryBuilder");

test("tasks", async (t) => {
	const themeLibraryBuilder = new ThemeLibraryBuilder({
		resourceCollections: {
			workspace: {
				byGlob: async () => {
					return [];
				}
			}
		},
		buildContext: {
			isRootProject: () => {
				return true;
			}
		},
		project: {
			metadata: {
				name: "name",
				copyright: "copyright"
			},
			type: "type"
		},
		parentLogger: {
			createSubLogger: () => {
				return {
					createTaskLogger: () => {

					}
				};
			}
		}
	});
	const asyncTasks = Object.keys(themeLibraryBuilder.tasks).map((taskKey) => {
		return themeLibraryBuilder.tasks[taskKey]();
	});

	t.is(asyncTasks.length, 4, "all 4 tasks should be added");
});