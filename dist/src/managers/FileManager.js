"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchSummaryJsonFileData = exports.getSummaryJsonFilePath = exports.getFileDataAsJson = exports.getFile = void 0;
const Util_1 = require("../utils/Util");
const fs = require("fs");
const Summary_1 = require("../models/Summary");
function getFile(name) {
    let file_path = Util_1.getSoftwareDir();
    if (Util_1.isWindows()) {
        return `${file_path}\\${name}`;
    }
    return `${file_path}/${name}`;
}
exports.getFile = getFile;
function getFileDataAsJson(filepath) {
    if (fs.existsSync(filepath)) {
        try {
            const content = fs.readFileSync(filepath, "utf-8");
            return JSON.parse(content);
        }
        catch (e) {
            console.log("File not found: " + filepath);
        }
    }
    return null;
}
exports.getFileDataAsJson = getFileDataAsJson;
function getSummaryJsonFilePath() {
    return getFile("userSummary.json");
}
exports.getSummaryJsonFilePath = getSummaryJsonFilePath;
function fetchSummaryJsonFileData() {
    // checks if summary JSON exists. If not populates it with base values
    const filepath = getSummaryJsonFilePath();
    if (!fs.existsSync(filepath)) {
        // create a blank summary
        fs.writeFileSync(filepath, [JSON.stringify(new Summary_1.Summary(), null, 2)]);
    }
    try {
        return getFileDataAsJson(filepath);
    }
    catch (e) {
        console.log("File not found: " + filepath);
    }
    return new Summary_1.Summary();
}
exports.fetchSummaryJsonFileData = fetchSummaryJsonFileData;
//# sourceMappingURL=FileManager.js.map