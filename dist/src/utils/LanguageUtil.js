"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getLanguages = void 0;
const Util_1 = require("./Util");
const FileManager_1 = require("../managers/FileManager");
function getFileSummaryJson() {
    return FileManager_1.getFile("fileChangeSummary.json");
}
function getLanguages() {
    const fileSummary = FileManager_1.getFileDataAsJson(getFileSummaryJson());
    let languages = [];
    if (fileSummary) {
        const dateNow = new Date();
        for (const key in fileSummary) {
            const endTime = fileSummary[key]["end"] * 1000; // seconds to milliseconds
            // checks if edited today
            if (Util_1.compareDates(dateNow, new Date(endTime))) {
                const language = fileSummary[key]["syntax"];
                languages.push(language);
            }
        }
    }
    // for no duplicates, we convert array into set and back into array
    languages = Array.from(new Set(languages));
    return languages;
}
exports.getLanguages = getLanguages;
//# sourceMappingURL=LanguageUtil.js.map