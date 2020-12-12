import { compareDates, getItem, isLoggedIn } from "./Util";
import fs = require("fs");
import { CodetimeMetrics } from "../models/CodetimeMetrics";
import { Log } from "../models/Log";
import {
    incrementSummaryShare,
    updateSummaryJson,
    getSummaryTotalHours,
    setSummaryCurrentHours,
    setSummaryTotalHours
} from "./SummaryUtil";
import { getFileDataAsJson, getFile } from "../managers/FileManager";
import { isResponseOk, softwareDelete, softwareGet, softwarePost, softwarePut } from "../managers/HttpManager";
import { commands, window } from "vscode";
import { getAllMilestones } from "./MilestonesUtil";
import { NO_TITLE_LABEL } from "./Constants";

const moment = require("moment-timezone");

let currently_deleting_log_date: number = -1;

export function getLogsFilePath(): string {
    return getFile("logs.json");
}

export function checkLogsJson(): boolean {
    const filepath = getLogsFilePath();
    if (!fs.existsSync(filepath)) {
        // create empty logs
        const logs: Array<Log> = [];
        try {
            fs.writeFileSync(filepath, JSON.stringify(logs, null, 2));
        } catch (e) {
            return false;
        }
    }
    return true;
}

export function deleteLogsJson() {
    const filepath = getLogsFilePath();
    const fileExists = fs.existsSync(filepath);
    if (fileExists) {
        fs.unlinkSync(filepath);
    }
}

export function getAllLogObjects(): Array<Log> {
    const exists = checkLogsJson();
    if (exists) {
        const filepath = getLogsFilePath();
        const logs = getFileDataAsJson(filepath);
        return logs || [];
    }
    return [];
}

export function writeToLogsJson(logs: Array<Log> = []) {
    const filepath = getLogsFilePath();
    try {
        fs.writeFileSync(filepath, JSON.stringify(logs, null, 2));
    } catch (err) {
        console.log(err);
    }
}

export function getLogsSummary(): any {
    const logs: Array<Log> = getAllLogObjects();
    let totalHours = 0;
    let totalLinesAdded = 0;
    let totalKeystrokes = 0;
    let totalDays = 0;
    let longest_streak = 0;
    let current_streak = 0;
    let currentHours = 0;
    let currentKeystrokes = 0;
    let currentLines = 0;
    let currentDate = 0;

    if (logs.length > 0) {
        const hours24 = 86400000;
        let previousDate = logs[0].date - hours24;
        for (let i = 0; i < logs.length - 1; i++) {
            totalHours += logs[i].codetime_metrics.hours;
            totalLinesAdded += logs[i].codetime_metrics.lines_added;
            totalKeystrokes += logs[i].codetime_metrics.keystrokes;
            totalDays++;
            if (compareDates(new Date(previousDate + hours24), new Date(logs[i].date))) {
                current_streak++;
                if (current_streak > longest_streak) {
                    longest_streak = current_streak;
                }
            } else {
                current_streak = 0;
            }

            previousDate = logs[i].date;
        }

        const lastLog = logs[logs.length - 1];

        // checks if last log is today
        if (compareDates(new Date(lastLog.date), new Date())) {
            currentHours = lastLog.codetime_metrics.hours;
            currentKeystrokes = lastLog.codetime_metrics.keystrokes;
            currentLines = lastLog.codetime_metrics.lines_added;
            totalDays++;
        } else {
            totalHours += lastLog.codetime_metrics.hours;
            totalLinesAdded += lastLog.codetime_metrics.lines_added;
            totalKeystrokes += lastLog.codetime_metrics.keystrokes;
            totalDays++;
        }
        if (compareDates(new Date(previousDate + hours24), new Date(lastLog.date))) {
            current_streak++;
            if (current_streak > longest_streak) {
                longest_streak = current_streak;
            }
        } else {
            current_streak = 0;
        }

        currentDate = lastLog.date;
    }

    return {
        totalHours,
        totalLinesAdded,
        totalKeystrokes,
        totalDays,
        longest_streak,
        current_streak,
        currentHours,
        currentKeystrokes,
        currentLines,
        currentDate
    };
}

export function getDayNumberFromDate(dateUnix: number): number {
    const logs = getAllLogObjects();
    let date = new Date(dateUnix);
    for (let log of logs) {
        if (compareDates(new Date(log.date), date)) {
            return log.day_number;
        }
    }
    return -1;
}

/**
 * compares a log to the logs stored locally to check if it already exists
 * checks against both date and day number
 * @param log - a log object
 */
function checkIfLogExists(log: Log): boolean {
    let logExists = false;

    const logEndOfDay = moment(log.date).endOf("day");
    const logDayNumber = log.day_number;

    const logs = getAllLogObjects();
    const existingLogs = logs.filter(n => {
        let endOfDay = moment(n.date).endOf("day");
        let dayNumber = n.day_number;
        return logEndOfDay === endOfDay && logDayNumber === dayNumber;
    });

    if (existingLogs.length > 0) {
        logExists = true;
    }

    return logExists;
}

export function setDailyMilestonesByDayNumber(dayNumber: number, newMilestones: Array<number>) {
    let logs = getAllLogObjects();
    let log = logs[dayNumber - 1];
    newMilestones = newMilestones.concat(log.milestones);
    newMilestones = Array.from(new Set(newMilestones));
    log.milestones = newMilestones;
    writeToLogsJson(logs);
}

export async function addLogToJson(
    title: string,
    description: string,
    hours: string,
    keystrokes: string,
    lines: string,
    links: Array<string>
) {
    const numLogs = getLatestLogEntryNumber();

    if (numLogs === 0) {
        console.log("Logs json could not be read");
        return false;
    }

    let codetimeMetrics = new CodetimeMetrics();

    codetimeMetrics.hours = parseFloat(hours);
    codetimeMetrics.lines_added = parseInt(lines);
    codetimeMetrics.keystrokes = parseInt(keystrokes);

    let log = new Log();
    log.title = title;
    log.description = description;
    log.links = links;
    log.date = Date.now();
    log.codetime_metrics = codetimeMetrics;

    const logExists = checkIfLogExists(log);

    // if log exists, we need to edit log not create one
    if (logExists) {
        return updateLog(log);
    } else {
        log.day_number = numLogs + 1;
        await createLog(log);
    }

    updateSummaryJson();
}

export function getLatestLogEntryNumber(): number {
    const logs = getAllLogObjects();
    return logs ? logs.length : 0;
}

export function getMostRecentLogObject(): Log | any {
    const logs = getAllLogObjects();
    if (logs.length > 0) {
        return logs[logs.length - 1];
    } else {
        return new Log();
    }
}

export function getLogDateRange(): Array<number> {
    const logs = getAllLogObjects();
    let dates = [];
    if (logs.length) {
        dates.push(logs[0].date);
        dates.push(logs[logs.length - 1].date);
    }
    return dates;
}

export function getAllCodetimeHours(): Array<number> {
    const logs = getAllLogObjects();
    let sendHours: Array<number> = [];
    for (let i = 0; i < logs.length; i++) {
        if (logs[i].day_number) {
            sendHours.push(logs[i].codetime_metrics.hours);
        }
    }
    return sendHours;
}

export function getLastSevenLoggedDays(): Array<Log> {
    const logs = getAllLogObjects();

    let sendLogs: Array<Log> = [];
    if (logs.length === 0) {
        return sendLogs;
    }
    if (logs[logs.length - 1].title !== NO_TITLE_LABEL) {
        sendLogs.push(logs[logs.length - 1]);
    }
    for (let i = logs.length - 2; i >= 0; i--) {
        if (logs[i].day_number) {
            sendLogs.push(logs[i]);
            if (sendLogs.length === 7) {
                return sendLogs;
            }
        }
    }
    return sendLogs;
}

export function checkIfOnStreak(): boolean {
    const logs = getAllLogObjects();
    // one day streak
    if (logs.length < 2) {
        return true;
    }
    const currDate = new Date(logs[logs.length - 1].date);
    const prevDatePlusDay = new Date(logs[logs.length - 2].date + 86400000);
    return compareDates(currDate, prevDatePlusDay);
}

export function updateLogShare(day: number) {
    let logs = getAllLogObjects();
    if (!logs[day - 1].shared) {
        logs[day - 1].shared = true;
        incrementSummaryShare();
        writeToLogsJson(logs);
    }
}

export async function editLogEntry(
    dayNumber: number,
    title: string,
    description: string,
    links: Array<string>,
    editedHours: number
) {
    let logs = getAllLogObjects();
    let log = logs[dayNumber - 1];
    log.title = title;
    log.description = description;
    log.links = links;
    const currentLoggedHours = log.codetime_metrics.hours;
    if (editedHours >= 0 && editedHours <= 12) {
        log.codetime_metrics.hours = editedHours;
    } else if (editedHours < 0) {
        log.codetime_metrics.hours = 0;
    } else {
        log.codetime_metrics.hours = 12;
    }
    let summaryTotalHours = getSummaryTotalHours();
    if (dayNumber === logs.length) {
        setSummaryCurrentHours(log.codetime_metrics.hours);
    } else {
        summaryTotalHours -= currentLoggedHours;
        summaryTotalHours += log.codetime_metrics.hours;
        setSummaryTotalHours(summaryTotalHours);
    }
    await updateLog(log);
}

function isLogEmpty(log: Log): boolean {
    return (
        log.codetime_metrics.hours === 0 &&
        log.codetime_metrics.keystrokes === 0 &&
        log.codetime_metrics.lines_added === 0 &&
        log.title === NO_TITLE_LABEL &&
        (log.description === "No Description" || !log.description) &&
        log.milestones.length === 0 &&
        (log.links.length === 0 || (log.links.length === 1 && log.links[0] === ""))
    );
}

/**
 * If the last log is empty (NO_TITLE_LABEL, keystrokes, etc) then set the log date
 */
export async function resetPreviousLogIfEmpty() {
    const logDate = new Date();
    let logs = getAllLogObjects();
    if (logs.length > 0) {
        // get the last log
        const log: Log = logs[logs.length - 1];
        if (log && isLogEmpty(log)) {
            log.date = logDate.valueOf();
            logs[logs.length - 1] = log;
            // update the rest of the info like end of day and persist to the backend
            updateLog(log);
        }
    }
}

// updates a log locally and on the server
async function updateLog(log: Log) {
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

// creates a new log locally and on the server
async function createLog(log: Log) {
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

// pulls logs from the server and saves them locally. This will be run periodically.
// logs have a format like [ { day_number: 1, date: ... }, ... ]
export async function syncLogs() {
    const jwt = getItem("jwt");
    let serverLogs: Array<Log> = getLocalLogsFromFile();
    if (jwt) {
        const resp = await softwareGet("/100doc/logs", jwt);
        if (isResponseOk(resp)) {
            serverLogs = resp.data;
        }
    }

    let createLogForToday = true;
    const currentDay = moment().format("YYYY-MM-DD");

    if (serverLogs && serverLogs.length) {
        // these come back sorted in ascending order
        const formattedLogs = formatLogs(serverLogs);
        // check if we have one for today
        const lastLoggedDay = moment(formattedLogs[formattedLogs.length - 1].date).format("YYYY-MM-DD");
        
        // if we don't have a log for today, we'll create an empty one
        if (currentDay === lastLoggedDay) {
            createLogForToday = false;
        }
        await addMilestonesToLogs(formattedLogs);
        saveLogsToFile(formattedLogs);
    }

    if (createLogForToday && isLoggedIn()) {
        // create a log for today and add it to the local logs
        // await addDailyLog();
        const log:Log = new Log();
        log.day_number = (await getLocalLogsFromFile()).length + 1;
        await createLog(log);
    }
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

function saveLogsToFile(logs: Array<Log> = []) {
    const filePath = getLogFilePath();
    try {
        fs.writeFileSync(filePath, JSON.stringify(logs, null, 2));
    } catch (err) {
        console.log(err);
    }
}

function getLocalLogsFromFile(): Array<Log> {
    const filePath = getLogFilePath();

    let logs: Array<Log> = [];
    const exists = checkIfLocalFileExists(filePath);
    if (exists) {
        logs = getFileDataAsJson(filePath);
    }
    return logs || [];
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

// formats logs from the server into the local log model format before saving locally
// logs have a format like [ { day_number: 1, date: ... }, ... ]
function formatLogs(logs: Array<Log>) {
    let formattedLogs: Array<Log> = [];

    logs.forEach((log: any) => {
        let formattedLog = new Log();
        formattedLog.title = log.title;
        formattedLog.description = log.description;
        formattedLog.day_number = log.day_number;
        formattedLog.codetime_metrics.hours = log.minutes ? parseFloat((log.minutes / 60).toFixed(2)) : 0;
        formattedLog.codetime_metrics.keystrokes = log.keystrokes;
        formattedLog.codetime_metrics.lines_added = log.lines_added;
        formattedLog.date = log.unix_date ? log.unix_date * 1000 : 0; // seconds --> milliseconds
        formattedLog.links = log.ref_links || [];
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
    const milestoneData = getAllMilestones();
    if (logs && milestoneData) {
        const milestones = milestoneData.milestones;
        for (let log of logs) {
            const logMilestones = milestones.filter(n => n.day_number && n.day_number === log.day_number);
            if (logMilestones) {
                // extract the milestone ids
                const milestoneIds = logMilestones.map(n => n.id);
                log.milestones = Array.from(new Set(milestoneIds));
            }
        }
    }

    writeToLogsJson(logs);
}