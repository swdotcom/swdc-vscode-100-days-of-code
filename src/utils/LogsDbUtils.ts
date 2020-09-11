import fs = require("fs");
import { getFile } from "../managers/FileManager";

export let updatedLogsDb = true;
export let sentLogsDb = true;

let toCreateLogs: Array<any> = [];
let toUpdateLogs: Array<any> = [];

function getLogsPayloadFilePath(): string {
    return getFile("logsPayload.json");
}

export function createLogsPayloadJson() {
    const filepath = getLogsPayloadFilePath();
    const fileData = {
        updatedLogsDb,
        sentLogsDb,
        toCreateLogs,
        toUpdateLogs
    };
    try {
        fs.writeFileSync(filepath, JSON.stringify(fileData, null, 2));
    } catch (err) {
        console.log(err);
    }
}

export function deleteLogsPayloadJson() {
    const filepath = getLogsPayloadFilePath();
    const fileExists = fs.existsSync(filepath);
    if (fileExists) {
        fs.unlinkSync(filepath);
    }
}
