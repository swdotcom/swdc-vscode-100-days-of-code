import fs = require("fs");
const moment = require("moment-timezone");
import { getItem } from "./Util";
import { softwareGet, isResponseOk, softwarePost, softwarePut, softwareDelete } from "../managers/HttpManager";
import { getFileDataAsJson, getFile } from "../managers/FileManager";
import { fetchAllMilestones } from "./MilestonesDbUtil";
import { Log } from "../models/Log";
import { commands, window } from "vscode";

let currently_deleting_log_date: number = -1;

// creates a new log locally and on the server
export async function createLog(log: Log) {
    // get all log objects
    const logs = await getLocalLogsFromFile();
    // add the new log
    const updatedLogs = [...logs, log];
    // write back to the local file
    saveLogsToFile(updatedLogs);
    // push the new log to the server
    const preparedLog = await prepareLogForServerUpdate(log);
    await pushNewLogToServer(preparedLog);
}

// updates a log locally and on the server
export async function updateLog(log: Log) {
    // get all log objects
    const logs = await getLocalLogsFromFile();
    // find and update the log object
    const logEndOfDay = moment(log.date).endOf("day").format("MM DD YYYY");
    const logDayNumber = log.day_number;
    const index = logs.findIndex(n => {
        let endOfDay = moment(n.date).endOf("day").format("MM DD YYYY");
        let dayNumber = n.day_number;
        return logEndOfDay === endOfDay && logDayNumber === dayNumber;
    });
    // replace
    logs[index] = log;
    // write back to local
    saveLogsToFile(logs);
    // push changes to server
    const preparedLog = await prepareLogForServerUpdate(log);
    await updateExistingLogOnServer(preparedLog);
}

// pulls logs from the server and saves them locally. This will be run periodically.
// logs have a format like [ { day_number: 1, date: ... }, ... ]
export async function syncLogs() {
    const jwt = getItem("jwt");
    let serverLogs = null;
    if (jwt) {
        const resp = await softwareGet("/100doc/logs", jwt);
        if (isResponseOk(resp)) {
            serverLogs = resp.data;
        }
    }

    if (serverLogs) {
        const formattedLogs = formatLogs(serverLogs);
        await addMilestonesToLogs(formattedLogs);
        saveLogsToFile(formattedLogs);
    }
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
    const milestones = await fetchAllMilestones();
    logs.forEach(async log => {
        let foundMilestones = milestones ? milestones.find((e: any) => e.day_number === log.day_number) : null;
        if (foundMilestones && foundMilestones.milestones) {
            log.milestones = foundMilestones.milestones;
        }
    });
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
    if (jwt) {
        await softwarePost("/100doc/logs", [log], jwt);
    }
}

// push new local logs to the server
async function updateExistingLogOnServer(log: {}) {
    const jwt = getItem("jwt");
    if (jwt) {
        await softwarePut("/100doc/logs", [log], jwt);
    }
}

async function getLocalLogsFromFile() {
    const filePath = getLogFilePath();
    const localLogs = await getLogsFromFile(filePath);
    return localLogs;
}

function getLogsFromFile(filepath: string): Array<Log> {
    let logs: Array<Log> = [];
    const exists = checkIfLocalFileExists(filepath);
    if (exists) {
        logs = getFileDataAsJson(filepath);
    }
    return logs;
}

function saveLogsToFile(logs: Array<Log> = []) {
    const filePath = getLogFilePath();
    try {
        fs.writeFileSync(filePath, JSON.stringify(logs, null, 2));
    } catch (err) {
        console.log(err);
    }
}

function getLogFilePath(): string {
    return getFile("logs.json");
}

function checkIfLocalFileExists(filepath: string): boolean {
    if (fs.existsSync(filepath)) {
        return true;
    } else {
        return false;
    }
}

export async function deleteLogDay(unix_date: number) {
    if (currently_deleting_log_date !== -1) {
        window.showInformationMessage("Currently waiting to delete the requested log, please wait.");
        return;
    }
    const jwt = getItem("jwt");
    if (jwt) {
        currently_deleting_log_date = unix_date;
        const resp = await softwareDelete("/100doc/logs", { unix_dates: [unix_date] }, jwt);
        if (isResponseOk(resp)) {
            window.showInformationMessage("Your log has been successfully deleted.");
            // delete the log
            let logs: Array<Log> = await getLocalLogsFromFile();
            // delete the log based on the dayNum
            logs = logs.filter((n: Log) => n.date !== unix_date);
            saveLogsToFile(logs);
            await syncLogs();
            commands.executeCommand("DoC.viewLogs");
        }
        currently_deleting_log_date = -1;
    }
}
