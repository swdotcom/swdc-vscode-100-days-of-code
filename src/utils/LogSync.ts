import fs = require("fs");
const moment = require("moment-timezone");
import { getItem } from "./Util";
import { serverIsAvailable, softwareGet, isResponseOk, softwarePost } from "../managers/HttpManager";
import { getSoftwareDir, isWindows, getFileDataAsJson } from "./Util";
import { Log } from "../models/Log";

export async function syncLogs() {
    await fetchAndSaveServerLogsToFile();

    const serverLogs = await getServerLogsFromFile();
    const localLogs = await getLocalLogsFromFile();

    // check if there are any server logs that are not in the local logs
    const missingServerLogsOnLocal = compareLogFiles(serverLogs, localLogs);
    if (missingServerLogsOnLocal.length > 0) {
        // pull the server logs into the local logs file
        let updatedLocalLogs = localLogs.concat(missingServerLogsOnLocal);
        updateLogsFromServer(updatedLocalLogs);
    }

    // check if there are any local logs that are not in the server logs
    const missingLocalLogsOnServer = compareLogFiles(localLogs, serverLogs);
    if (missingLocalLogsOnServer.length > 0) {
        // push the local logs to the server
        pushLogsToServer(missingLocalLogsOnServer);
    }
}

// checks for logs that are in A but not in B and returns the delta
function compareLogFiles(A: Array<Log>, B: Array<Log>) {
    let deltaLogs: Array<Log> = [];
    A.forEach(a => {
        let aEndOfDay = moment(a.date).endOf("day");
        let aDayNumber = a.day_number;

        const logExistsInB = B.filter(b => {
            let bEndOfDay = moment(b.date).endOf("day");
            let bDayNumber = b.day_number;
            return aEndOfDay === bEndOfDay && aDayNumber === bDayNumber;
        });

        // if the log is not found in B, add it to the delta
        if (!logExistsInB) deltaLogs.push(a);
    });
    return deltaLogs;
}

async function getServerLogsFromFile() {
    const serverLogsJson = await getServerLogsJson();
    const serverLogs = await getLogsFromFile(serverLogsJson);
    return serverLogs;
}

async function getLocalLogsFromFile() {
    const localLogsJson = getLocalLogsJson();
    const localLogs = await getLogsFromFile(localLogsJson);
    return localLogs;
}

function getLogsFromFile(filepath: string): Array<Log> {
    let logs: Array<Log> = [];
    const exists = checkIfLocalFileExists(filepath);
    if (exists) {
        const logsData = getFileDataAsJson(filepath, { logs: [] });
        logs = logsData.logs;
    }
    return logs;
}

async function fetchAndSaveServerLogsToFile() {
    const serverLogsJson = await getServerLogsJson();
    const serverLogs = await fetchLogsFromServer();
    if (serverLogs) saveLogsToFile(serverLogs, serverLogsJson);
}

function saveLogsToFile(logs: Array<Log>, filepath: string) {
    try {
        fs.writeFileSync(filepath, JSON.stringify(logs, null, 4));
    } catch (err) {
        console.log(err);
    }
}

// push new local logs to the server
async function pushLogsToServer(logs: Array<Log>) {
    const jwt = getItem("jwt");
    if (!jwt) return;

    const available = await serverIsAvailable();
    if (available) {
        softwarePost("/100doc/logs", logs, jwt);
    }
}

// pull logs from the server into local
async function updateLogsFromServer(updatedLocalLogs: Array<Log>) {
    const localLogsJson = await getLocalLogsJson();
    saveLogsToFile(updatedLocalLogs, localLogsJson);
}

async function fetchLogsFromServer() {
    let logs: Array<Log> = [];
    const jwt = getItem("jwt");
    if (!jwt) return;

    const available = await serverIsAvailable();
    if (available) {
        await softwareGet("/100doc/logs", jwt).then(resp => {
            if (isResponseOk(resp)) {
                logs = resp.data;
            }
        });
    }
    return logs;
}

function getLocalLogsJson(): string {
    let file = getSoftwareDir();
    if (isWindows()) {
        file += "\\logs.json";
    } else {
        file += "/logs.json";
    }
    return file;
}

function getServerLogsJson(): string {
    let file = getSoftwareDir();
    if (isWindows()) {
        file += "\\serverLogs.json";
    } else {
        file += "/serverLogs.json";
    }
    return file;
}

function checkIfLocalFileExists(filepath: string): boolean {
    if (fs.existsSync(filepath)) {
        return true;
    } else {
        return false;
    }
}
