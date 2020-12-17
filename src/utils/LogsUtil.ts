import { compareDates, getItem, isLoggedIn } from "./Util";
import fs = require("fs");
import { CodetimeMetrics } from "../models/CodetimeMetrics";
import { Log } from "../models/Log";
import {
    incrementSummaryShare,
    updateSummaryJson,
    getSummaryTotalHours,
    setSummaryCurrentHours,
    setSummaryTotalHours,
    getCurrentChallengeRound
} from "./SummaryUtil";
import { getFileDataAsJson, getFile } from "../managers/FileManager";
import { isResponseOk, softwareDelete, softwareGet, softwarePost, softwarePut } from "../managers/HttpManager";
import { commands, window } from "vscode";
import { getAllMilestones } from "./MilestonesUtil";
import { NO_TITLE_LABEL } from "./Constants";

const queryString = require("query-string");
const moment = require("moment-timezone");

let currently_deleting_log_date: number = -1;

export function getLogsFilePath(): string {
    return getFile("logs.json");
}

export function deleteLogsJson() {
    const filepath = getLogsFilePath();
    const fileExists = fs.existsSync(filepath);
    if (fileExists) {
        fs.unlinkSync(filepath);
    }
}

export function getAllDescendingOrderLogObjects(): Array<Log> {
    const filepath = getLogsFilePath();
    let logs = getFileDataAsJson(filepath);
    if (logs && logs.length) {
        // sort by unix_date in descending order
        logs = logs.sort(
            (a: Log, b: Log) => b.unix_date - a.unix_date
        );
    }
    return logs || [];
}

export function getLogByUnixDate(unix_date: number): Log {
    const logs: Array<Log> = getAllDescendingOrderLogObjects();
    if (logs && logs.length) {
        return logs.find(n => n.unix_date === unix_date);
    }
    return null;
}

export function getDayNumberLog(day_number: number): Log {
    const logs: Array<Log> = getAllDescendingOrderLogObjects();
    if (logs && logs.length) {
        logs.reverse();
        return logs.find(n => n.day_number === day_number);
    }
    return null;
}

export function updateDayNumberLog(log: Log) {
    const logs: Array<Log> = getAllDescendingOrderLogObjects();
    if (logs && logs.length) {
        logs.reverse();
        for (let i = 0; i < logs.length; i++) {
            let existingLog = logs[i];
            if (existingLog.day_number === log.day_number) {
                logs[i] = log;
                writeToLogsJson(logs);
                break;
            }
        }
    }
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
    const logs: Array<Log> = getAllDescendingOrderLogObjects();
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
    const logs = getAllDescendingOrderLogObjects();
    let date = new Date(dateUnix);
    for (let log of logs) {
        if (compareDates(new Date(log.date), date)) {
            return log.day_number;
        }
    }
    return -1;
}

export function setDailyMilestonesByDayNumber(dayNumber: number, newMilestones: Array<number>) {
    let log = getDayNumberLog(dayNumber);
    newMilestones = newMilestones.concat(log.milestones);
    newMilestones = Array.from(new Set(newMilestones));
    log.milestones = newMilestones;
    updateDayNumberLog(log);
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
    if (title) {
        log.title = title;
    }
    log.description = description;
    log.links = links;
    log.codetime_metrics = codetimeMetrics;
    log.day_number = getDayNumberForNewLog();
    log.challenge_round = getCurrentChallengeRound();

    await createLog(log);

    updateSummaryJson();
}

// Get the last log's day_number. If the date is the
// same use the same day_number. If not, increment it.
export function getDayNumberForNewLog() {
    const lastLog = getMostRecentLogObject();
    const currentDay = moment().format("YYYY-MM-DD");
    const lastLogDay = moment(lastLog.date).format("YYYY-MM-DD");
    if (currentDay == lastLogDay) {
        return lastLog.day_number;
    }
    return lastLog.day_number + 1;
}

export function getLatestLogEntryNumber(): number {
    let logs = getAllDescendingOrderLogObjects();
    return logs ? logs.length : 0;
}

export function getMostRecentLogObject(): Log | any {
    const logs = getAllDescendingOrderLogObjects();
    
    if (logs && logs.length > 0) {
        // get the most recent one
        return logs[0];
    }
    const log:Log = new Log();
    log.day_number = 1;
    log.challenge_round = getCurrentChallengeRound();
    return log;
}

export function getLogDateRange(): Array<number> {
    const logs = getAllDescendingOrderLogObjects();
    let dates = [];
    if (logs.length) {
        dates.push(logs[0].date);
        dates.push(logs[logs.length - 1].date);
    }
    return dates;
}

export function getAllCodetimeHours(): Array<number> {
    const logs = getAllDescendingOrderLogObjects();
    let sendHours: Array<number> = [];
    for (let i = 0; i < logs.length; i++) {
        if (logs[i].day_number) {
            sendHours.push(logs[i].codetime_metrics.hours);
        }
    }
    return sendHours;
}

export function getLastSevenLoggedDays(): Array<Log> {
    const logs = getAllDescendingOrderLogObjects();

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
    const logs = getAllDescendingOrderLogObjects();
    // one day streak
    if (logs.length < 2) {
        return true;
    }
    const currDate = new Date(logs[logs.length - 1].date);
    const prevDatePlusDay = new Date(logs[logs.length - 2].date + 86400000);
    return compareDates(currDate, prevDatePlusDay);
}

export function updateLogShare(day: number) {
    const log = getDayNumberLog(day);
    if (log && !log.shared) {
        log.shared = true;
        incrementSummaryShare();
        updateDayNumberLog(log);
    }
}

export async function editLogEntry(
    dayNumber: number,
    unix_date: number,
    title: string,
    description: string,
    links: Array<string>,
    editedHours: number
) {
    let log = getLogByUnixDate(unix_date);
    log.title = title;
    log.description = description;
    log.links = links;
    log.unix_date = unix_date;
    const currentLoggedHours = log.codetime_metrics.hours;
    if (editedHours >= 0 && editedHours <= 12) {
        log.codetime_metrics.hours = editedHours;
    } else if (editedHours < 0) {
        log.codetime_metrics.hours = 0;
    } else {
        log.codetime_metrics.hours = 12;
    }
    let summaryTotalHours = getSummaryTotalHours();
    if (dayNumber === getAllDescendingOrderLogObjects().length) {
        setSummaryCurrentHours(log.codetime_metrics.hours);
    } else {
        summaryTotalHours -= currentLoggedHours;
        summaryTotalHours += log.codetime_metrics.hours;
        setSummaryTotalHours(summaryTotalHours);
    }
    await updateLog(log);
}

// updates a log locally and on the server
async function updateLog(log: Log) {
    // get all log objects
    const logs = await getLocalLogsFromFile();

    const index = logs.findIndex(n => n.unix_date === log.unix_date);
    // replace
    logs[index] = log;
    // write back to local
    saveLogsToFile(logs);
    // push changes to server
    const preparedLog = await prepareLogForServerUpdate(log);
    await updateExistingLogOnServer(preparedLog);
}

// creates a new log locally and on the server
export async function createLog(log: Log) {
    // get all log objects
    const logs = await getLocalLogsFromFile();
    // push the new log to the server
    const preparedLog:Log = await prepareLogForServerUpdate(log);
    // add the new log
    const updatedLogs = [...logs, preparedLog];
    // write back to the local file
    saveLogsToFile(updatedLogs);
    
    await pushNewLogToServer(preparedLog);
}

export async function deleteLogDay(unix_date: number) {
    if (currently_deleting_log_date !== -1) {
        window.showInformationMessage("Currently waiting to delete the requested log, please wait.");
        return;
    }

    currently_deleting_log_date = unix_date;
    
    const resp = await softwareDelete("/100doc/logs", { unix_dates: [unix_date] }, getItem("jwt"));
    if (isResponseOk(resp)) {
        window.showInformationMessage("Your log has been successfully deleted.");
        // delete the log
        let logs: Array<Log> = await getLocalLogsFromFile();
        // delete the log based on the dayNum
        logs = logs.filter((n: Log) => n.unix_date !== unix_date);
        saveLogsToFile(logs);
        await syncLogs();
        commands.executeCommand("DoC.viewLogs");
    }
    currently_deleting_log_date = -1;

}

// pulls logs from the server and saves them locally. This will be run periodically.
// logs have a format like [ { day_number: 1, date: ... }, ... ]
export async function syncLogs() {
    let serverLogs: Array<Log> = getLocalLogsFromFile();

    const qryStr = queryString.stringify({
        challenge_round: getCurrentChallengeRound()
    });
    const resp = await softwareGet(`/100doc/logs?${qryStr}`, getItem("jwt"));
    if (isResponseOk(resp)) {
        serverLogs = resp.data;
    }

    let createLogForToday = true;
    const currentDay = moment().format("YYYY-MM-DD");

    if (serverLogs && serverLogs.length) {
        // these come back sorted in ascending order
        const formattedLogs = formatLogs(serverLogs);

        // check if we have one for today
        const lastLoggedDay = moment(formattedLogs[0].date).format("YYYY-MM-DD");
        
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
        log.day_number = getDayNumberForNewLog();
        log.challenge_round = getCurrentChallengeRound();
        await createLog(log);
    }
}

// converts local log to format that server will accept
function prepareLogForServerUpdate(log: Log) {
    const offset_seconds = new Date().getTimezoneOffset() * 60;

    let preparedLog = {
        ...log,
        minutes: log.codetime_metrics.hours * 60,
        keystrokes: log.codetime_metrics.keystrokes,
        lines_added: log.codetime_metrics.lines_added,
        lines_removed: 0,
        unix_date: moment(log.date).unix(),
        local_date: moment(log.date).unix() - offset_seconds,
        offset_minutes: offset_seconds / 60,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        challenge_round: log.challenge_round || getCurrentChallengeRound()
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

export function getLogFilePath(): string {
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
    await softwarePost("/100doc/logs", [log], getItem("jwt"));
}

// push new local logs to the server
async function updateExistingLogOnServer(log: {}) {
    await softwarePut("/100doc/logs", [log], getItem("jwt"));
}

// formats logs from the server into the local log model format before saving locally
// logs have a format like [ { day_number: 1, date: ... }, ... ]
function formatLogs(logs: Array<Log>) {
    const formattedLogs: Array<Log> = [];
    logs.forEach((log: any) => {
        if (!log.codetime_metrics) {
            log.codetime_metrics = new CodetimeMetrics();
        }
        if (!log.date) {
            log.date = log.unix_date * 1000;
        }
        log.codetime_metrics.hours = log.minutes ? parseFloat((log.minutes / 60).toFixed(2)) : 0;
        log.codetime_metrics.keystrokes = log.keystrokes;
        log.codetime_metrics.lines_added = log.lines_added;
        log.links = log.ref_links || [];
        if (!log.challenge_round) {
            log.challenge_round = getCurrentChallengeRound();
        }
        formattedLogs.push(log);
    });
    // sorts logs in descending order
    formattedLogs.sort((a: Log, b: Log) => {
        return b.day_number - a.day_number;
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