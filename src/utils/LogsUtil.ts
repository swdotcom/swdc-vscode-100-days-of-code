import { getSoftwareDir, isWindows, compareDates } from "./Util";
import fs = require("fs");
import { CodetimeMetrics } from "../models/CodetimeMetrics";
import { Log } from "../models/Log";
import { getMilestonesByDate, checkIfDaily } from "./MilestonesUtil";
import { getSessionCodetimeMetrics } from "./MetricUtil";
import {
    incrementSummaryShare,
    updateSummaryJson,
    getSummaryTotalHours,
    setSummaryCurrentHours,
    setSummaryTotalHours,
    reevaluateSummary
} from "./SummaryUtil";
import { window, commands } from "vscode";
import { fetchMilestones, pushMilestonesToDb } from "./MilestonesDbUtil";
import {
    pushNewLogs,
    pushUpdatedLogs,
    clearToCreateLogs,
    toCreateLogsPush,
    clearToUpdateLogs,
    toUpdateLogsPush
} from "./LogsDbUtils";
import { pushSummaryToDb } from "./SummaryDbUtil";
import { HOURS_THRESHOLD } from "./Constants";
import { getFileDataAsJson } from "../managers/FileManager";
const moment = require("moment-timezone");
let dateLogMessage: Date | any = undefined;

export function getLogsJson(): string {
    let file = getSoftwareDir();
    if (isWindows()) {
        file += "\\logs.json";
    } else {
        file += "/logs.json";
    }
    return file;
}

export function checkLogsJson(): boolean {
    const filepath = getLogsJson();
    try {
        if (fs.existsSync(filepath)) {
            return true;
        } else {
            fs.writeFileSync(filepath, '{"logs": []}');
            return true;
        }
    } catch (err) {
        return false;
    }
}

export function deleteLogsJson() {
    const filepath = getLogsJson();
    const fileExists = fs.existsSync(filepath);
    if (fileExists) {
        fs.unlinkSync(filepath);
    }
}

export function getAllLogObjects(): Array<Log> {
    const exists = checkLogsJson();
    if (exists) {
        const filepath = getLogsJson();
        const rawLogs = getFileDataAsJson(filepath, { logs: [] });
        return rawLogs.logs;
    }
    return [];
}

function writeToLogsJson(logs: Array<Log>) {
    const sendLogs = { logs };
    const filepath = getLogsJson();
    try {
        fs.writeFileSync(filepath, JSON.stringify(sendLogs, null, 4));
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

        // checks if last log is today
        if (compareDates(new Date(logs[logs.length - 1].date), new Date())) {
            currentHours = logs[logs.length - 1].codetime_metrics.hours;
            currentKeystrokes = logs[logs.length - 1].codetime_metrics.keystrokes;
            currentLines = logs[logs.length - 1].codetime_metrics.lines_added;
            totalDays++;
        } else {
            totalHours += logs[logs.length - 1].codetime_metrics.hours;
            totalLinesAdded += logs[logs.length - 1].codetime_metrics.lines_added;
            totalKeystrokes += logs[logs.length - 1].codetime_metrics.keystrokes;
            totalDays++;
        }
        if (compareDates(new Date(previousDate + hours24), new Date(logs[logs.length - 1].date))) {
            current_streak++;
            if (current_streak > longest_streak) {
                longest_streak = current_streak;
            }
        } else {
            current_streak = 0;
        }

        currentDate = logs[logs.length - 1].date;
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
 * Compares server logs with local logs and then syncs them
 * @param logs - logs returned by the server
 */
export async function compareWithLocalLogs(logs: Array<Log>) {
    let localLogs: Array<Log> = getAllLogObjects();
    let changed = false;

    // if local logs has more entries than logs, merge them
    if (localLogs.length > logs.length) {
        return mergeLocalLogs(localLogs, logs);
    }

    // if local logs have fewer entries than logs, add server logs to local
    if (localLogs.length < logs.length) {
        logs.forEach(log => {
            // check if a localLog for that day number exists
            const foundDay = localLogs.find(e => e.day_number === log.day_number);
            if (foundDay) {
                return;
            } else {
                // if it doesn't exist, add it to localLogs
                localLogs.push(log);
            }
        });
        // make sure localLogs are sorted by date
        localLogs.sort((a, b) => {
            return a.date - b.date;
        });
        changed = true;
    }

    // fetch all the milestones at once and then add them to each log iteratively below
    const milestones = await fetchMilestones(null, true);

    // make sure localLogs are in sync with the server
    localLogs.forEach(async localLog => {
        let log = logs.find(e => e.day_number === localLog.day_number);
        // no log, no need to update localLog
        if (!log) {
            return;
        }

        // if there are two logs for the same date with different date numbers (e.g. same day generated on different dates)
        // then realign the days so that the numbering is correct
        if (log.day_number !== localLog.day_number || !compareDates(new Date(log.date), new Date(localLog.date))) {
            return mergeLocalLogs(localLogs, logs);
        }

        // continue updating each log
        if (log.title !== localLog.title) {
            localLog.title = log.title;
            changed = true;
        }
        if (log.description !== localLog.description) {
            localLog.description = log.description;
            changed = true;
        }
        if (JSON.stringify(log.links) !== JSON.stringify(localLog.links)) {
            localLog.links = log.links;
            changed = true;
        }
        if (log.codetime_metrics.hours > localLog.codetime_metrics.hours) {
            localLog.codetime_metrics.hours = log.codetime_metrics.hours;
            changed = true;
        }
        if (log.codetime_metrics.keystrokes > localLog.codetime_metrics.keystrokes) {
            localLog.codetime_metrics.keystrokes = log.codetime_metrics.keystrokes;
            changed = true;
        }
        if (log.codetime_metrics.lines_added > localLog.codetime_metrics.lines_added) {
            localLog.codetime_metrics.lines_added = log.codetime_metrics.lines_added;
            changed = true;
        }

        let foundMilestones = milestones.find(e => e.day_number === localLog.day_number);
        if (foundMilestones && foundMilestones.milestones) {
            localLog.milestones = foundMilestones.milestones;
        }
    });

    if (changed) {
        writeToLogsJson(localLogs);
        reevaluateSummary();
        restoreAllMilestones();
    }
}

async function mergeLocalLogs(localLogs: Array<Log>, dbLogs: Array<Log>) {
    const logs = localLogs.concat(dbLogs);
    logs.sort((a: Log, b: Log) => {
        return a.date - b.date;
    });

    const milestones = await fetchMilestones(null, true);

    let i = 0;
    while (i < logs.length - 1) {
        if (compareDates(new Date(logs[i].date), new Date(logs[i + 1].date))) {
            if (logs[i].title !== logs[i + 1].title) {
                // Case: i is No Title, we replace it with i+1 (which might be No Title, so No Title will stay)
                // Case: i+1 is No Title, we keep title form i
                // Case: Neither is No Title, we replace it with i "OR" i+1
                if (logs[i].title === "No Title") {
                    logs[i].title = logs[i + 1].title;
                } else if (logs[i + 1].title !== "No Title") {
                    logs[i].title += " OR ";
                    logs[i].title += logs[i + 1].title;
                }
            }
            if (logs[i].description !== logs[i + 1].description) {
                // Case: i is No Description, we replace it with i+1 (which might be No Description, so No Description will stay)
                // Case: i+1 is No Description, we keep title form i
                // Case: Neither is No Description, we replace it with i "OR" i+1
                if (logs[i].description === "No Description") {
                    logs[i].description = logs[i + 1].description;
                } else if (logs[i + 1].title !== "No Description") {
                    logs[i].description += " OR ";
                    logs[i].description += logs[i + 1].description;
                }
            }
            const newLinks = logs[i].links.concat(logs[i + 1].links);
            logs[i].links = Array.from(new Set(newLinks));
            if (logs[i].codetime_metrics.hours < logs[i + 1].codetime_metrics.hours) {
                logs[i].codetime_metrics.hours = logs[i + 1].codetime_metrics.hours;
            }
            if (logs[i].codetime_metrics.keystrokes < logs[i + 1].codetime_metrics.keystrokes) {
                logs[i].codetime_metrics.keystrokes = logs[i + 1].codetime_metrics.keystrokes;
            }
            if (logs[i].codetime_metrics.lines_added < logs[i + 1].codetime_metrics.lines_added) {
                logs[i].codetime_metrics.lines_added = logs[i + 1].codetime_metrics.lines_added;
            }

            let foundMilestones = milestones.find(e => e.date === logs[i].date);
            if (foundMilestones && foundMilestones.milestones) {
                foundMilestones = foundMilestones.concat(logs[i].milestones);
                foundMilestones = Array.from(new Set(foundMilestones));
                logs[i].milestones = foundMilestones;
                pushMilestonesToDb(logs[i].date, foundMilestones);
            }

            // remove logs[i+1] as it is now merged with logs[i]
            logs.splice(i + 1, 1);
            // no increment as i still needs to check with the new i+1
        } else {
            i++;
        }
    }

    for (let i = 0; i < logs.length; i++) {
        logs[i].day_number = i + 1;
    }

    writeToLogsJson(logs);

    // Updates the userSummary.json with the merged logs data
    reevaluateSummary();

    let rawToUpdateLogs = logs;

    if (logs.length > dbLogs.length) {
        rawToUpdateLogs = logs.slice(0, dbLogs.length);

        const rawToCreateLogs = logs.slice(dbLogs.length);
        clearToCreateLogs();
        rawToCreateLogs.forEach(log => {
            toCreateLogsPush(log);
        });
    }

    clearToUpdateLogs();
    rawToUpdateLogs.forEach(log => {
        toUpdateLogsPush(log);
    });

    await pushNewLogs(false);
    await pushUpdatedLogs(false, 0);
    await pushSummaryToDb();

    // updates all local milestones and logs
    restoreAllMilestones();
}

async function restoreAllMilestones() {
    let logs = getAllLogObjects();
    for (let i = 0; i < logs.length; i++) {
        logs[i].milestones = getMilestonesByDate(logs[i].date);
    }
    writeToLogsJson(logs);
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

export function updateLogMilestonesByDates(dates: Array<number>) {
    let logs = getAllLogObjects();
    for (let date of dates) {
        const dayNumber = getDayNumberFromDate(date);
        let allMilestonesFromDay: Array<number> = getMilestonesByDate(date);
        let milestones: Array<number> = [];

        // Only keep daily milestones from logs
        for (let milestone of logs[dayNumber - 1].milestones) {
            if (checkIfDaily(milestone)) {
                milestones.push(milestone);
            }
        }

        // Add all other milestones earned that day to the daily ones
        milestones = milestones.concat(allMilestonesFromDay);
        milestones = Array.from(new Set(milestones));
        logs[dayNumber - 1].milestones = milestones;

        // updating the db as it goes on.
        pushMilestonesToDb(date, milestones);
    }

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
    const dayNum = getLatestLogEntryNumber() + 1;

    if (dayNum === 0) {
        console.log("Logs json could not be read");
        return false;
    }

    let logs = getAllLogObjects();

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
    log.day_number = dayNum;

    const logExists = checkIfLogExists(log);

    // if log exists, we need to edit log not create one
    if (logExists) {
        return updateLogByDate(log);
    }

    logs.push(log);
    writeToLogsJson(logs);

    updateSummaryJson();
    await pushNewLogs(true);
}

export function getLatestLogEntryNumber(): number {
    const logs = getAllLogObjects();
    return logs.length;
}

export function getMostRecentLogObject(): Log | any {
    let logs = getAllLogObjects();
    if (logs.length > 0) {
        return logs[logs.length - 1];
    } else {
        return;
    }
}

export function getLogDateRange(): Array<number> {
    const logs = getAllLogObjects();
    let dates = [];
    dates.push(logs[0].date);
    dates.push(logs[logs.length - 1].date);
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
    if (logs[logs.length - 1].title !== "No Title") {
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

export async function updateLogByDate(log: Log) {
    const logDate = new Date(log.date);
    let logs = getAllLogObjects();
    const logExists = checkIfLogExists(log);
    if (!logExists) {
        addLogToJson(
            log.title,
            log.description,
            log.codetime_metrics.hours.toString(),
            log.codetime_metrics.keystrokes.toString(),
            log.codetime_metrics.lines_added.toString(),
            log.links
        );
        return;
    }

    for (let i = logs.length - 1; i >= 0; i--) {
        const dateOb = new Date(logs[i].date);

        // Checking if date matches
        if (compareDates(dateOb, logDate)) {
            logs[i].title = log.title;
            logs[i].description = log.description;
            logs[i].links = log.links;
            logs[i].date = log.date;
            logs[i].codetime_metrics.keystrokes = log.codetime_metrics.keystrokes;
            logs[i].codetime_metrics.lines_added = log.codetime_metrics.lines_added;
            logs[i].codetime_metrics.hours = log.codetime_metrics.hours;

            writeToLogsJson(logs);
            updateSummaryJson();
            await pushUpdatedLogs(true, logs[i].day_number);
            return;
        }
    }
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
    writeToLogsJson(logs);
    await pushUpdatedLogs(true, dayNumber);
}

function checkIfLogIsEmpty(log: Log): boolean {
    return (
        log.codetime_metrics.hours === 0 &&
        log.codetime_metrics.keystrokes === 0 &&
        log.codetime_metrics.lines_added === 0 &&
        log.title === "No Title" &&
        log.description === "No Description" &&
        log.milestones.length === 0 &&
        (log.links.length === 0 || (log.links.length === 1 && log.links[0] === ""))
    );
}

export async function resetPreviousLogIfEmpty() {
    const logDate = new Date();
    let logs = getAllLogObjects();
    if (logs.length > 0 && checkIfLogIsEmpty(logs[logs.length - 1])) {
        logs[logs.length - 1].date = logDate.valueOf();
        writeToLogsJson(logs);
        reevaluateSummary();
        await pushUpdatedLogs(true, logs[logs.length - 1].day_number);
        return;
    }
}

export async function updateLogsMilestonesAndMetrics(milestones: Array<number>) {
    const logDate = new Date();
    let logs = getAllLogObjects();

    let log = new Log();
    // if date doesn't exist, create a log with just milestones and a date
    const logExists = checkIfLogExists(log);
    if (!logExists) {
        const dayNum = getLatestLogEntryNumber() + 1;
        log.date = logDate.valueOf();
        log.milestones = milestones;
        log.codetime_metrics.hours = 0;
        log.codetime_metrics.keystrokes = 0;
        log.codetime_metrics.lines_added = 0;
        log.day_number = dayNum;
        log.title = "No Title";
        log.description = "No Description";
        log.links = [""];
        logs.push(log);

        writeToLogsJson(logs);
        updateSummaryJson();
        await pushNewLogs(true);
        return;
    }

    // date exists
    for (let i = logs.length - 1; i >= 0; i--) {
        const dateOb = new Date(logs[i].date);
        // Checking if date matches
        if (compareDates(dateOb, logDate)) {
            const metrics = getSessionCodetimeMetrics();
            // checks if new day and fresh start
            const checkForJump: boolean = i === logs.length - 1 && i > 0 && logs[i].codetime_metrics.hours === 0;

            // If user added extra hours, we don't want to reduce those
            logs[i].codetime_metrics.hours = Math.max(
                logs[i].codetime_metrics.hours,
                parseFloat((metrics.minutes / 60).toFixed(1))
            );
            logs[i].codetime_metrics.keystrokes = metrics.keystrokes;
            logs[i].codetime_metrics.lines_added = metrics.linesAdded;

            if (checkForJump) {
                // checks for irregular jumps
                if (logs[i].codetime_metrics.hours === logs[i - 1].codetime_metrics.hours) {
                    logs[i].codetime_metrics.hours = 0;
                }
                if (logs[i].codetime_metrics.keystrokes === logs[i - 1].codetime_metrics.keystrokes) {
                    logs[i].codetime_metrics.keystrokes = 0;
                }
                if (logs[i].codetime_metrics.lines_added === logs[i - 1].codetime_metrics.lines_added) {
                    logs[i].codetime_metrics.lines_added = 0;
                }
            }

            logs[i].milestones = logs[i].milestones.concat(milestones);

            writeToLogsJson(logs);
            updateSummaryJson();
            toUpdateLogsPush(logs[i]);
            if (
                (!dateLogMessage || !compareDates(dateLogMessage, new Date())) &&
                logs[i].codetime_metrics.hours > HOURS_THRESHOLD &&
                logs[i].codetime_metrics.hours < HOURS_THRESHOLD + 0.1 &&
                logs[i].title === "No Title"
            ) {
                window
                    .showInformationMessage("Don't forget to add and share today's log.", "Add Log")
                    .then(selection => {
                        dateLogMessage = new Date();
                        if (selection === "Add Log") {
                            commands.executeCommand("DoC.addLog");
                        }
                    });
            }
            return;
        }
    }
}
