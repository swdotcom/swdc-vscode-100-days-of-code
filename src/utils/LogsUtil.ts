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
import { fetchMilestonesByDate, pushMilestonesToDb, fetchAllMilestones } from "./MilestonesDbUtil";
import {
    pushNewLogs,
    pushUpdatedLogs,
    clearToCreateLogs,
    toCreateLogsPush,
    clearToUpdateLogs,
    toUpdateLogsPush
} from "./LogsDbUtils";
import { pushSummaryToDb } from "./SummaryDbUtil";
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
        const rawLogs = fs.readFileSync(filepath).toString();
        return JSON.parse(rawLogs).logs;
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

    const hours24 = 86400000;
    let previousDate = logs[0].date - hours24;
    for (let log of logs) {
        totalHours += log.codetime_metrics.hours;
        totalLinesAdded += log.codetime_metrics.lines_added;
        totalKeystrokes += log.codetime_metrics.keystrokes;
        totalDays++;
        if (compareDates(new Date(previousDate + hours24), new Date(log.date))) {
            current_streak++;
            if (current_streak > longest_streak) {
                longest_streak = current_streak;
            }
        } else {
            current_streak = 0;
        }
        previousDate = log.date;
    }

    return {
        totalHours,
        totalLinesAdded,
        totalKeystrokes,
        totalDays,
        longest_streak,
        current_streak
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

export async function compareWithLocalLogs(logs: Array<Log>) {
    let localLogs: Array<Log> = getAllLogObjects();
    let changed = false;

    if (localLogs.length > logs.length) {
        return mergeLocalLogs(localLogs, logs);
    }

    for (let i = 0; i < localLogs.length; i++) {
        if (
            logs[i].day_number !== localLogs[i].day_number ||
            !compareDates(new Date(logs[i].date), new Date(localLogs[i].date))
        ) {
            return mergeLocalLogs(localLogs, logs);
        }
        if (logs[i].title !== localLogs[i].title) {
            localLogs[i].title = logs[i].title;
            changed = true;
        }
        if (logs[i].description !== localLogs[i].description) {
            localLogs[i].description = logs[i].description;
            changed = true;
        }
        if (JSON.stringify(logs[i].links) !== JSON.stringify(localLogs[i].links)) {
            localLogs[i].links = logs[i].links;
            changed = true;
        }
        if (logs[i].codetime_metrics.hours > localLogs[i].codetime_metrics.hours) {
            localLogs[i].codetime_metrics.hours = logs[i].codetime_metrics.hours;
            changed = true;
        }
        if (logs[i].codetime_metrics.keystrokes > localLogs[i].codetime_metrics.keystrokes) {
            localLogs[i].codetime_metrics.keystrokes = logs[i].codetime_metrics.keystrokes;
            changed = true;
        }
        if (logs[i].codetime_metrics.lines_added > localLogs[i].codetime_metrics.lines_added) {
            localLogs[i].codetime_metrics.lines_added = logs[i].codetime_metrics.lines_added;
            changed = true;
        }
        if (
            localLogs[i].milestones.length === 0 &&
            (localLogs[i].codetime_metrics.hours > 0.5 ||
                localLogs[i].codetime_metrics.keystrokes > 100 ||
                localLogs[i].codetime_metrics.lines_added > 0)
        ) {
            localLogs[i].milestones = await fetchMilestonesByDate(localLogs[i].date);
        }
    }

    if (localLogs.length < logs.length) {
        for (let i = localLogs.length; i < logs.length; i++) {
            logs[i].milestones = await fetchMilestonesByDate(logs[i].date);
            localLogs.push(logs[i]);
        }
        changed = true;
    }
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

            // fetch and update milestones in db
            let newMilestones = await fetchMilestonesByDate(logs[i].date);
            if (newMilestones) {
                newMilestones = newMilestones.concat(logs[i].milestones);
                newMilestones = Array.from(new Set(newMilestones));
                logs[i].milestones = newMilestones;
                pushMilestonesToDb(logs[i].date, newMilestones);
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

    const date = new Date();
    const offset_minutes = date.getTimezoneOffset();
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    let rawToUpdateLogs = logs;

    if (logs.length > dbLogs.length) {
        rawToUpdateLogs = logs.slice(0, dbLogs.length);

        const rawToCreateLogs = logs.slice(dbLogs.length);
        clearToCreateLogs();
        rawToCreateLogs.forEach(log => {
            const sendLog = {
                day_number: log.day_number,
                title: log.title,
                description: log.description,
                ref_links: log.links,
                minutes: log.codetime_metrics.hours * 60,
                keystrokes: log.codetime_metrics.keystrokes,
                lines_added: log.codetime_metrics.lines_added,
                lines_removed: 0,
                local_date: Math.round(log.date / 1000), // milliseconds --> seconds
                offset_minutes,
                timezone
            };
            toCreateLogsPush(sendLog);
        });
    }

    clearToUpdateLogs();
    rawToUpdateLogs.forEach(log => {
        const sendLog = {
            day_number: log.day_number,
            title: log.title,
            description: log.description,
            ref_links: log.links,
            minutes: log.codetime_metrics.hours * 60,
            keystrokes: log.codetime_metrics.keystrokes,
            lines_added: log.codetime_metrics.lines_added,
            lines_removed: 0,
            local_date: Math.round(log.date / 1000), // milliseconds --> seconds
            offset_minutes,
            timezone
        };
        toUpdateLogsPush(sendLog);
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

function checkIfDateExists(): boolean {
    const dateNow = new Date();
    const logs = getAllLogObjects();

    for (let i = logs.length - 1; i >= 0; i--) {
        const dateOb = new Date(logs[i].date);
        // Older date
        if (dateNow.valueOf > dateOb.valueOf) {
            return false;
        }

        // Checking if date exists
        if (compareDates(dateOb, dateNow)) {
            return true;
        }
    }
    return false;
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

    // if date exists, we need to edit log not create one
    const dateExists = checkIfDateExists();
    if (dateExists) {
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
    const dateExists = checkIfDateExists();
    if (!dateExists) {
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
            // If user added extra hours, we don't want to reduce those
            logs[i].codetime_metrics.hours = Math.max(logs[i].codetime_metrics.hours, log.codetime_metrics.hours);

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

export async function updateLogsMilestonesAndMetrics(milestones: Array<number>) {
    const metrics = getSessionCodetimeMetrics();
    const logDate = new Date();
    let logs = getAllLogObjects();

    // if date doesn't exist, create a log with just milestones and a date
    const dateExists = checkIfDateExists();
    if (!dateExists) {
        let log = new Log();
        const dayNum = getLatestLogEntryNumber() + 1;
        log.date = logDate.valueOf();
        log.milestones = milestones;
        log.codetime_metrics.hours = parseFloat((metrics.minutes / 60).toFixed(1));
        log.codetime_metrics.keystrokes = metrics.keystrokes;
        log.codetime_metrics.lines_added = metrics.linesAdded;
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
            // If user added extra hours, we don't want to reduce those
            logs[i].codetime_metrics.hours = Math.max(
                logs[i].codetime_metrics.hours,
                parseFloat((metrics.minutes / 60).toFixed(1))
            );
            logs[i].codetime_metrics.keystrokes = Math.max(logs[i].codetime_metrics.keystrokes, metrics.keystrokes);
            logs[i].codetime_metrics.lines_added = Math.max(logs[i].codetime_metrics.lines_added, metrics.linesAdded);

            logs[i].milestones = logs[i].milestones.concat(milestones);

            writeToLogsJson(logs);
            updateSummaryJson();
            await pushUpdatedLogs(true, logs[i].day_number);

            if (
                (!dateLogMessage || !compareDates(dateLogMessage, new Date())) &&
                logs[i].codetime_metrics.hours > 0.3 &&
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
