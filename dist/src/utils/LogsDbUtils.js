"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteLogsPayloadJson = void 0;
const fs = require("fs");
const FileManager_1 = require("../managers/FileManager");
function getLogsPayloadFilePath() {
    return FileManager_1.getFile("logsPayload.json");
}
function deleteLogsPayloadJson() {
    const filepath = getLogsPayloadFilePath();
    const fileExists = fs.existsSync(filepath);
    if (fileExists) {
        fs.unlinkSync(filepath);
    }
}
exports.deleteLogsPayloadJson = deleteLogsPayloadJson;
//# sourceMappingURL=LogsDbUtils.js.map