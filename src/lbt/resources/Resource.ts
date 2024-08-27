import {promisify} from "node:util";
import fs from "graceful-fs";
const readFile = promisify(fs.readFile);

class Resource {
	constructor(pool, name, file, stat) {
		this.pool = pool;
		this.name = name;
		this.file = file;
		this.fileSize = stat ? stat.size : -1;
	}

	/**
	 * @returns Buffer of file
	 */
	async buffer() {
		return readFile(this.file);
	}

	/**
	 * @returns String of the file content
	 */
	async string() {
		return (await this.buffer()).toString();
	}
}

export default Resource;
