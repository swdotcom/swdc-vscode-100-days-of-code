import fs = require("fs");
import { getFile } from "../managers/FileManager";

function getLogsPayloadFilePath(): string {
    return getFile("logsPayload.json");
}

export function deleteLogsPayloadJson() {
    const filepath = getLogsPayloadFilePath();
    const fileExists = fs.existsSync(filepath);
    if (fileExists) {
        fs.unlinkSync(filepath);
    }
}
