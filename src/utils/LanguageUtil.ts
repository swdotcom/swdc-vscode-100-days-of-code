import { getSoftwareDir, isWindows } from "./Util";
import fs = require("fs");

export function getFileSummaryJson() {
    let file = getSoftwareDir();
    if (isWindows()) {
        file += "\\fileChangeSummary.json";
    } else {
        file += "/fileChangeSummary.json";
    }
    return file;
}

export function getLanguages() {
    const fileSummaryFile = getFileSummaryJson();
    let filesString: string;
    try {
        let exists = false;
        let retries = 5;
        while (retries > 0 && !exists) {
            exists = fs.existsSync(fileSummaryFile);
            retries--;
        }
        if (exists) {
            filesString = fs.readFileSync(fileSummaryFile).toString();
        } else {
            return [];
        }
    } catch (err) {
        console.log(err);
        return [];
    }
    const fileJson = JSON.parse(filesString);

    let languages: Array<string> = [];
    let key: string;
    for (key in fileJson) {
        const language = fileJson[key]["syntax"];
        languages.push(language);
    }

    // for no duplicates, we convert arry into set and back into array
    languages = Array.from(new Set(languages));

    return languages;
}
