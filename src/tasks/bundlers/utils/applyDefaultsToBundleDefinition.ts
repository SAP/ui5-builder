/**
 * Applies default values to bundleDefinitions
 *
 * @param bundleDefinition Module
 *		bundle definition
 * @param [taskUtil] TaskUtil
 *
 * @returns
 */
export function applyDefaultsToBundleDefinition(bundleDefinition: object, taskUtil) {
	bundleDefinition.sections = bundleDefinition?.sections?.map((section) => {
		const defaultValues = {
			resolve: false,
			resolveConditional: false,
			renderer: false,
			sort: true,
			declareRawModules: false,
		};

		// Since specVersion: 4.0 "require" section starts loading asynchronously.
		// If specVersion cannot be determined, the latest spec is taken into account.
		// This is a breaking change in specVersion: 4.0
		if (section.mode === "require") {
			// Builder.js already treats missing async flag as truthy value and builds asynchronously by default

			if (taskUtil?.getProject().getSpecVersion().lt("4.0")) {
				defaultValues.async = false;
			}
		}

		return Object.assign(defaultValues, section);
	});

	return bundleDefinition;
}
