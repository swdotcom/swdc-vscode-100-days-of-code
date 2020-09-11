import { compareDates } from "./Util";
import fs = require("fs");
import { CodetimeMetrics } from "../models/CodetimeMetrics";
import { Log } from "../models/Log";
import { getMilestonesByDate, checkIfDaily } from "./MilestonesUtil";
import {
    incrementSummaryShare,
    updateSummaryJson,
    getSummaryTotalHours,
    setSummaryCurrentHours,
    setSummaryTotalHours
} from "./SummaryUtil";
import { pushMilestonesToDb } from "./MilestonesDbUtil";
import { createLog, updateLog } from "./LogSync";
import { getFileDataAsJson, getFile } from "../managers/FileManager";
const moment = require("moment-timezone");

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

function writeToLogsJson(logs: Array<Log> = []) {
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
        return updateLog(log);
    } else {
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
        log.title === "No Title" &&
        log.description === "No Description" &&
        log.milestones.length === 0 &&
        (log.links.length === 0 || (log.links.length === 1 && log.links[0] === ""))
    );
}

/**
 * If the last log is empty (no title, keystrokes, etc) then set the log date
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
