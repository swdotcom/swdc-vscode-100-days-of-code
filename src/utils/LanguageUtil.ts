import { getSoftwareDir, isWindows, compareDates, getFileDataAsJson } from "./Util";
import fs = require("fs");

function getFileSummaryJson() {
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
    let fileJson;
    try {
        // retries help when a user downloads Code Time with 100 Days of Code
        // they allow the file to be created and not throw errors
        let exists = false;
        let retries = 5;
        while (retries > 0 && !exists) {
            exists = fs.existsSync(fileSummaryFile);
            retries--;
        }
        if (exists) {
            fileJson = getFileDataAsJson(fileSummaryFile, {});
        } else {
            return [];
        }
    } catch (err) {
        return [];
    }

    const dateNow = new Date();
    let languages: Array<string> = [];
    let key: string;
    for (key in fileJson) {
        const endTime = fileJson[key]["end"] * 1000; // seconds to milliseconds
        // checks if edited today
        if (compareDates(dateNow, new Date(endTime))) {
            const language = fileJson[key]["syntax"];
            languages.push(language);
        }
    }

    // for no duplicates, we convert array into set and back into array
    languages = Array.from(new Set(languages));

    return languages;
}
