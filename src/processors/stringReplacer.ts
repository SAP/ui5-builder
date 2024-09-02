/**
 * @module @ui5/builder/processors/stringReplacer
 */

/**
 * Replaces placeholders with corresponding values.
 *
 * @param parameters Parameters
 * @param parameters.resources List of resources to be processed
 * @param parameters.options Options
 * @param parameters.options.pattern Pattern of placeholders
 * @param parameters.options.replacement Replacement for placeholders
 * @returns Promise resolving with modified resources
 */
export default function ({resources, options: {pattern, replacement}}: object) {
	return Promise.all(resources.map(async (resource) => {
		const content = await resource.getString();
		const newContent = content.replaceAll(pattern, replacement);
		if (content !== newContent) {
			resource.setString(newContent);
		}
		return resource;
	}));
}
