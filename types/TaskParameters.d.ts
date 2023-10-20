// declare module "@ui5/builder/task/TaskParameters" {
import type { TaskUtil } from "@ui5/project/build/helpers/TaskUtil";

// Mock some of the types, so it would be easier to follow
declare type ui5_fs_DuplexCollection = object

// This one should be (eventually) provided globally or as a part of @ui5/project/Specification 
declare type availableSpecVersions = "2.0" | "2.2" | "3.0" | "3.2";

declare interface TaskParametersBase {
	workspace: ui5_fs_DuplexCollection,
	options: {
		omitSourceMapResources?: boolean,
		useInputSourceMaps?: boolean,
	}
}

declare interface TaskParameters_2_2<specVersion extends availableSpecVersions> extends TaskParametersBase {
	taskUtil: TaskUtil<specVersion>
}

export declare type TaskParameters<specVersion extends availableSpecVersions> = specVersion extends "2.2" | "3.0" | "3.2"
	? TaskParameters_2_2<specVersion>
	: TaskParametersBase
// }
