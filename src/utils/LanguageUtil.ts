import { getSoftwareDir, isWindows, compareDates } from "./Util";
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
    const fileSummary = getFileSummaryJson();

    let languages: Array<string> = [];
    if (fileSummary) {
        const dateNow = new Date();

        let key: string;
        for (key in fileSummary) {
            const endTime = fileSummary[key]["end"] * 1000; // seconds to milliseconds
            // checks if edited today
            if (compareDates(dateNow, new Date(endTime))) {
                const language = fileSummary[key]["syntax"];
                languages.push(language);
            }
        }
    }

    // for no duplicates, we convert array into set and back into array
    languages = Array.from(new Set(languages));

    return languages;
}
