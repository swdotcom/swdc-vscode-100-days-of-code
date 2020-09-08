import fs = require("fs");
const moment = require("moment-timezone");
import { getItem } from "./Util";
import { serverIsAvailable, softwareGet, isResponseOk, softwarePost, softwarePut } from "../managers/HttpManager";
import { getSoftwareDir, isWindows, getFileDataAsJson } from "./Util";
import { fetchMilestones } from "./MilestonesDbUtil";
import { Log } from "../models/Log";

// pulls logs from the server and saves them locally. This will be run periodically.
export async function syncLogs() {
    const serverLogs = await fetchLogsFromServer();
    if (serverLogs) {
        const formattedLogs = formatLogs(serverLogs);
        addMilestonesToLogs(formattedLogs);
        updateLocalLogs(formattedLogs);
    }
}

// returns an array of logs from the server
// logs have a format like [ { day_number: 1, date: ... }, ... ]
async function fetchLogsFromServer() {
    let logs: [] = [];
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

// formats logs from the server into the local log model format before saving locally
// logs have a format like [ { day_number: 1, date: ... }, ... ]
function formatLogs(logs: []) {
    let formattedLogs: Array<Log> = [];
    logs.forEach((log: any) => {
        let formattedLog = new Log();
        formattedLog.title = log.title;
        formattedLog.description = log.description;
        formattedLog.day_number = log.day_number;
        formattedLog.codetime_metrics.hours = parseFloat((log.minutes / 60).toFixed(2));
        formattedLog.codetime_metrics.keystrokes = log.keystrokes;
        formattedLog.codetime_metrics.lines_added = log.lines_added;
        formattedLog.date = log.unix_date * 1000; // seconds --> milliseconds
        formattedLog.links = log.ref_links;
        formattedLogs.push(formattedLog);
    });
    // sorts logs in ascending order
    formattedLogs.sort((a: Log, b: Log) => {
        return a.day_number - b.day_number;
    });
    return formattedLogs;
}

// joins milestones to each log
async function addMilestonesToLogs(logs: Array<Log>) {
    // fetch all the milestones at once and then add them to each log iteratively below
    const milestones = await fetchMilestones(null, true);
    logs.forEach(async log => {
        let foundMilestones = milestones.find(e => e.day_number === log.day_number);
        if (foundMilestones && foundMilestones.milestones) {
            log.milestones = foundMilestones.milestones;
        }
    });
}

// creates a new log locally and on the server
async function createLog(log: Log) {
    // get all log objects
    const logs = await getLocalLogsFromFile();
    // add the new log
    const updatedLogs = [...logs, log];
    // write back to the local file
    updateLocalLogs(updatedLogs);
    // push the new log to the server
    const preparedLog = await prepareLogForServerUpdate(log);
    pushNewLogToServer(preparedLog);
}

// updates a log locally and on the server
async function updateLog(log: Log) {
    // get all log objects
    const logs = await getLocalLogsFromFile();
    // find and update the log object
    const logEndOfDay = moment(log.date).endOf("day");
    const logDayNumber = log.day_number;
    const index = logs.findIndex(n => {
        let endOfDay = moment(n.date).endOf("day");
        let dayNumber = n.day_number;
        return logEndOfDay === endOfDay && logDayNumber === dayNumber;
    });
    if (index) {
        // replace
        logs[index] = log;
    }
    // write back to local
    updateLocalLogs(logs);
    // push changes to server
    const preparedLog = await prepareLogForServerUpdate(log);
    updateExistingLogOnServer(preparedLog);
}

// converts local log to format that server will accept
function prepareLogForServerUpdate(log: Log) {
    const offset_minutes = new Date().getTimezoneOffset();
    const preparedLog = {
        day_number: log.day_number,
        title: log.title,
        description: log.description,
        ref_links: log.links,
        minutes: log.codetime_metrics.hours * 60,
        keystrokes: log.codetime_metrics.keystrokes,
        lines_added: log.codetime_metrics.lines_added,
        lines_removed: 0,
        unix_date: Math.round(log.date / 1000), // milliseconds --> seconds
        local_date: Math.round(log.date / 1000) - offset_minutes * 60, // milliseconds --> seconds
        offset_minutes,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
    };
    return preparedLog;
}

// push new local logs to the server
async function pushNewLogToServer(log: {}) {
    const jwt = getItem("jwt");
    if (!jwt) return;

    const available = await serverIsAvailable();
    if (available) {
        softwarePost("/100doc/logs", [log], jwt);
    }
}

// push new local logs to the server
async function updateExistingLogOnServer(log: {}) {
    const jwt = getItem("jwt");
    if (!jwt) return;

    const available = await serverIsAvailable();
    if (available) {
        softwarePut("/100doc/logs", [log], jwt);
    }
}

// pull logs from the server into local
async function updateLocalLogs(logs: Array<Log>) {
    const localLogsJson = await getLocalLogsJson();
    saveLogsToFile(logs, localLogsJson);
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

function saveLogsToFile(logs: Array<Log>, filepath: string) {
    try {
        fs.writeFileSync(filepath, JSON.stringify(logs, null, 4));
    } catch (err) {
        console.log(err);
    }
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

function checkIfLocalFileExists(filepath: string): boolean {
    if (fs.existsSync(filepath)) {
        return true;
    } else {
        return false;
    }
}
