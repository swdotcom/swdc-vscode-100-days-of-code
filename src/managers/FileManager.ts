import { getSoftwareDir, isWindows } from "../utils/Util";
import fs = require("fs");
import { Summary } from "../models/Summary";


export function getFile(name: string) {
	let file_path = getSoftwareDir();
	if (isWindows()) {
		return `${file_path}\\${name}`;
	}
	return `${file_path}/${name}`;
}

export function getFileDataAsJson(filepath: string): any {
	if (fs.existsSync(filepath)) {
		try {
			const content: string = fs.readFileSync(filepath, "utf-8");
			return JSON.parse(content);
		} catch (e) {
			console.log("File not found: " + filepath);
		}
	}
	return null;
}

export function getSummaryJsonFilePath() {
	return getFile("userSummary.json");
}

export function fetchSummaryJsonFileData(): Summary {
	// checks if summary JSON exists. If not populates it with base values
	const filepath = getSummaryJsonFilePath();
	if (!fs.existsSync(filepath)) {
		// create a blank summary
		fs.writeFileSync(filepath, [JSON.stringify(new Summary(), null, 2)]);
	}

	try {
		return getFileDataAsJson(filepath);
	} catch (e) {
		console.log("File not found: " + filepath);
	}
	return new Summary();
}