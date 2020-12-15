import { compareDates } from "./Util";
import { getFile, getFileDataAsJson } from "../managers/FileManager";

function getFileSummaryJson() {
    return getFile("fileChangeSummary.json");
}

export function getLanguages() {
    const fileSummary = getFileDataAsJson(getFileSummaryJson());

    let languages: Array<string> = [];
    if (fileSummary) {
        const dateNow = new Date();

        for (const key in fileSummary) {
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
