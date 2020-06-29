import { getSoftwareDir, isWindows, compareDates, getSoftwareSessionAsJson } from "./Util";
import path = require("path");
import fs = require("fs");
import { CodetimeMetrics } from "../models/CodetimeMetrics";
import { Log } from "../models/Log";
import {
    getMilestoneById,
    checkSharesMilestones,
    fetchMilestonesByDate,
    pushMilestonesToDb,
    fetchAllMilestones,
    getMilestonesByDate,
    checkIfDaily
} from "./MilestonesUtil";
import { getSessionCodetimeMetrics } from "./MetricUtil";
import {
    getSummaryObject,
    incrementSummaryShare,
    updateSummaryJson,
    getSummaryTotalHours,
    setSummaryCurrentHours,
    setSummaryTotalHours,
    reevaluateSummary,
    pushSummaryToDb
} from "./SummaryUtil";
import { softwareGet, serverIsAvailable, softwarePost, isResponseOk, softwarePut } from "../managers/HttpManager";
import { window, commands } from "vscode";

export let updatedLogsDb = true;
export let sentLogsDb = true;

let toCreateLogs: Array<any> = [];
let toUpdateLogs: Array<any> = [];
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

function getAllLogObjects(): Array<Log> {
    const exists = checkLogsJson();
    if (exists) {
        const filepath = getLogsJson();
        const rawLogs = fs.readFileSync(filepath).toString();
        return JSON.parse(rawLogs).logs;
    }
    return [];
}

function getLogsTemplate() {
    return path.join(__dirname, "../assets/templates/logs.template.html");
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

function getLogsPayloadJson(): string {
    let file = getSoftwareDir();
    if (isWindows()) {
        file += "\\logsPayload.json";
    } else {
        file += "/logsPayload.json";
    }
    return file;
}

export function createLogsPayloadJson() {
    const filepath = getLogsPayloadJson();
    const fileData = {
        updatedLogsDb,
        sentLogsDb,
        toCreateLogs,
        toUpdateLogs
    };
    try {
        fs.writeFileSync(filepath, JSON.stringify(fileData, null, 4));
        console.log("Created file");
    } catch (err) {
        console.log(err);
    }
}

export function checkLogsPayload() {
    const filepath = getLogsPayloadJson();
    try {
        if (fs.existsSync(filepath)) {
            const payloadData = JSON.parse(fs.readFileSync(filepath).toString());
            updatedLogsDb = payloadData["updatedLogsDb"];
            sentLogsDb = payloadData["sentLogsDb"];
            toCreateLogs = payloadData["toCreateLogs"];
            toUpdateLogs = payloadData["toUpdateLogs"];
        }
    } catch (err) {
        console.log(err);
    }
}

export function getDayNumberFromDate(dateUnix: number): number {
    const exists = checkLogsJson();
    if (exists) {
        const filepath = getLogsJson();
        const rawLogs = fs.readFileSync(filepath).toString();
        const logs = JSON.parse(rawLogs).logs;

        let date = new Date(dateUnix);
        for (let log of logs) {
            if (compareDates(new Date(log.date), date)) {
                return log.day_number;
            }
        }
    }
    return -1;
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

export async function fetchLogs() {
    const jwt = getSoftwareSessionAsJson()["jwt"];
    const dateNow = new Date();
    let available = false;
    try {
        available = await serverIsAvailable();
    } catch (err) {
        available = false;
    }
    if (available) {
        const logs = await softwareGet("/100doc/logs", jwt).then(resp => {
            if (isResponseOk(resp)) {
                const rawLogs = resp.data;
                let logs: Array<Log> = [];
                rawLogs.forEach((element: any) => {
                    let log = new Log();
                    log.title = element.title;
                    log.description = element.description;
                    log.day_number = element.day_number;
                    log.codetime_metrics.hours = parseFloat((element.minutes / 60).toFixed(2));
                    log.codetime_metrics.keystrokes = element.keystrokes;
                    log.codetime_metrics.lines_added = element.lines_added;
                    log.date = element.local_date * 1000; // seconds --> milliseconds
                    log.links = element.ref_links;
                    logs.push(log);
                });
                // sorts log in ascending order
                logs.sort((a: Log, b: Log) => {
                    return a.day_number - b.day_number;
                });
                return logs;
            }
        });
        if (logs) {
            compareWithLocalLogs(logs);
            // exits out in the next iteration
        }
    }
}

async function compareWithLocalLogs(logs: Array<Log>) {
    const exists = checkLogsJson();
    if (exists) {
        const logFilepath = getLogsJson();
        let rawLogs = fs.readFileSync(logFilepath).toString();
        let localLogs: Array<Log> = JSON.parse(rawLogs).logs;
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
        }

        if (localLogs.length < logs.length) {
            for (let i = localLogs.length; i < logs.length; i++) {
                logs[i].milestones = await fetchMilestonesByDate(logs[i].date);
                localLogs.push(logs[i]);
            }
            changed = true;
        }

        if (changed) {
            const sendLogs = { logs: localLogs };
            try {
                fs.writeFileSync(logFilepath, JSON.stringify(sendLogs, null, 4));
            } catch (err) {
                console.log(err);
            }
        }
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
                logs[i].title += " OR ";
                logs[i].title += logs[i + 1].title;
            }
            if (logs[i].description !== logs[i + 1].description) {
                logs[i].description += "\nOR\n";
                logs[i].description += logs[i + 1].description;
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

    const sendLogs = { logs };
    try {
        fs.writeFileSync(getLogsJson(), JSON.stringify(sendLogs, null, 4));
    } catch (err) {
        console.log(err);
    }

    // Updates the userSummary.json with the merged logs data
    reevaluateSummary();

    const date = new Date();
    const offset_minutes = date.getTimezoneOffset();
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    let rawToUpdateLogs = logs;

    if (logs.length > dbLogs.length) {
        rawToUpdateLogs = logs.slice(0, dbLogs.length);

        const rawToCreateLogs = logs.slice(dbLogs.length);
        toCreateLogs = [];
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
            toCreateLogs.push(sendLog);
        });
    }

    toUpdateLogs = [];
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
        toUpdateLogs.push(sendLog);
    });

    await pushNewLogs(false);
    await pushUpdatedLogs(false, 0);
    await pushSummaryToDb();

    // updates all local milestones and logs
    await fetchAllMilestones();
}

export async function pushNewLogs(addNew: boolean) {
    if (addNew) {
        const log: Log = getMostRecentLogObject();
        const date = new Date();
        const offset_minutes = date.getTimezoneOffset();
        const links = log.links === [] ? [""] : log.links;
        const sendLog = {
            day_number: log.day_number,
            title: log.title,
            description: log.description,
            ref_links: links,
            minutes: log.codetime_metrics.hours * 60,
            keystrokes: log.codetime_metrics.keystrokes,
            lines_added: log.codetime_metrics.lines_added,
            lines_removed: 0,
            local_date: Math.round(log.date / 1000), // milliseconds --> seconds
            offset_minutes,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
        };
        toCreateLogs.push(sendLog);
    }
    let available = false;
    try {
        available = await serverIsAvailable();
    } catch (err) {
        available = false;
    }
    if (available) {
        const jwt = getSoftwareSessionAsJson()["jwt"];
        const resp = await softwarePost("100doc/logs", toCreateLogs, jwt);
        const added: boolean = isResponseOk(resp);
        if (!added) {
            sentLogsDb = false;
        } else {
            sentLogsDb = true;
            toCreateLogs = [];
        }
    } else {
        sentLogsDb = false;
    }
}

export async function pushUpdatedLogs(addNew: boolean, dayNumber: number) {
    // try to post new logs before sending edited
    // logs as the edits might be on the newer logs
    if (!sentLogsDb) {
        await pushNewLogs(false);
    }
    if (addNew) {
        const logsExists = checkLogsJson();
        if (logsExists) {
            const filepath = getLogsJson();
            let rawLogs = fs.readFileSync(filepath).toString();
            let logs = JSON.parse(rawLogs).logs;
            let log = logs[dayNumber - 1];
            const date = new Date();
            const offset_minutes = date.getTimezoneOffset();
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
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
            };
            toUpdateLogs.push(sendLog);
        } else {
            updatedLogsDb = false;
        }
    }
    let available = false;
    try {
        available = await serverIsAvailable();
    } catch (err) {
        available = false;
    }
    if (available) {
        const jwt = getSoftwareSessionAsJson()["jwt"];
        const added: boolean = isResponseOk(await softwarePut("100doc/logs", toUpdateLogs, jwt));
        if (!added) {
            updatedLogsDb = false;
        } else {
            updatedLogsDb = true;
            toUpdateLogs = [];
        }
    } else {
        updatedLogsDb = false;
    }
}

function checkIfDateExists(): boolean {
    const exists = checkLogsJson();
    if (exists) {
        const dateNow = new Date();
        const filepath = getLogsJson();
        const rawLogs = fs.readFileSync(filepath).toString();
        const logs = JSON.parse(rawLogs).logs;

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
    }
    return false;
}

export function setDailyMilestonesByDayNumber(dayNumber: number, newMilestones: Array<number>) {
    const exists = checkLogsJson();
    if (exists) {
        const filepath = getLogsJson();
        const rawLogs = fs.readFileSync(filepath).toString();
        let logs = JSON.parse(rawLogs).logs;
        let log = logs[dayNumber - 1];
        newMilestones = newMilestones.concat(log.milestones);
        newMilestones = Array.from(new Set(newMilestones));
        log.milestones = newMilestones;
        const sendLogs = { logs };
        try {
            fs.writeFileSync(filepath, JSON.stringify(sendLogs, null, 4));
        } catch (err) {
            console.log(err);
        }
    }
}

export function updateLogMilestonesByDates(dates: Array<number>) {
    const exists = checkLogsJson();
    if (!exists) {
        console.log("Cannot open logs json");
        return;
    }
    const filepath = getLogsJson();
    const rawLogs = fs.readFileSync(filepath).toString();
    let logs = JSON.parse(rawLogs).logs;
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

    const sendLogs = { logs };
    try {
        fs.writeFileSync(filepath, JSON.stringify(sendLogs, null, 4));
    } catch (err) {
        console.log(err);
    }
}

export async function addLogToJson(
    title: string,
    description: string,
    hours: string,
    keystrokes: string,
    lines: string,
    links: Array<string>
) {
    const exists = checkLogsJson();
    if (!exists) {
        console.log("error accessing json");
        return;
    }
    const dayNum = getLatestLogEntryNumber() + 1;

    if (dayNum === -1) {
        console.log("Logs json could not be read");
        return false;
    }

    const filepath = getLogsJson();
    const rawLogs = fs.readFileSync(filepath).toString();
    let logs = JSON.parse(rawLogs);

    let codetimeMetrics = new CodetimeMetrics();

    codetimeMetrics.hours = parseFloat(hours);
    codetimeMetrics.lines_added = parseInt(lines);
    codetimeMetrics.keystrokes = parseInt(keystrokes);

    const log = new Log();
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

    logs.logs.push(log);
    try {
        fs.writeFileSync(filepath, JSON.stringify(logs, null, 4));
    } catch (err) {
        console.log(err);
        return false;
    }
    updateSummaryJson();
    await pushNewLogs(true);
}

export function getLatestLogEntryNumber(): number {
    const exists = checkLogsJson();
    if (exists) {
        const dateNow = new Date();
        const filepath = getLogsJson();
        const rawLogs = fs.readFileSync(filepath).toString();
        const logs = JSON.parse(rawLogs).logs;

        return logs.length;
    }
    return -2;
}

export function getMostRecentLogObject() {
    const exists = checkLogsJson();
    if (exists) {
        const logFilepath = getLogsJson();
        const rawLogs = fs.readFileSync(logFilepath).toString();
        let logs = JSON.parse(rawLogs).logs;

        if (logs.length > 0) {
            return logs[logs.length - 1];
        } else {
            return;
        }
    }
    return;
}

export function getLogDateRange(): Array<number> {
    const exists = checkLogsJson();
    if (exists) {
        const filepath = getLogsJson();
        const rawLogs = fs.readFileSync(filepath).toString();
        const logs = JSON.parse(rawLogs).logs;
        let dates = [];
        dates.push(logs[0].date);
        dates.push(logs[logs.length - 1].date);
        return dates;
    } else {
        let dates = new Array(2);
        return dates;
    }
}

export function getAllCodetimeHours(): Array<number> {
    const exists = checkLogsJson();
    if (exists) {
        const filepath = getLogsJson();
        const rawLogs = fs.readFileSync(filepath).toString();
        const logs = JSON.parse(rawLogs).logs;

        let sendHours: Array<number> = [];
        for (let i = 0; i < logs.length; i++) {
            if (logs[i].day_number) {
                sendHours.push(logs[i].codetime_metrics.hours);
            }
        }
        return sendHours;
    }
    return [];
}

export function getLastSevenLoggedDays(): Array<Log> {
    const exists = checkLogsJson();
    if (exists) {
        const filepath = getLogsJson();
        const rawLogs = fs.readFileSync(filepath).toString();
        const logs = JSON.parse(rawLogs).logs;

        let sendLogs = [];
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
    return [];
}

export function checkIfOnStreak(): boolean {
    const exists = checkLogsJson();
    if (exists) {
        const filepath = getLogsJson();
        const rawLogs = fs.readFileSync(filepath).toString();
        const logs = JSON.parse(rawLogs).logs;
        // one day streak
        if (logs.length < 2) {
            return true;
        }
        const currDate = new Date(logs[logs.length - 1].date);
        const prevDatePlusDay = new Date(logs[logs.length - 2].date + 86400000);
        return compareDates(currDate, prevDatePlusDay);
    }
    return false;
}

export async function updateLogByDate(log: Log) {
    const exists = checkLogsJson();
    if (exists) {
        const logDate = new Date(log.date);
        const filepath = getLogsJson();
        const rawLogs = fs.readFileSync(filepath).toString();
        let logs = JSON.parse(rawLogs).logs;

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
                const sendLogs = { logs };

                try {
                    fs.writeFileSync(filepath, JSON.stringify(sendLogs, null, 4));
                } catch (err) {
                    console.log(err);
                    return;
                }
                await pushUpdatedLogs(true, logs[i].day_number);
                return;
            }
        }
    }
}

export function updateLogShare(day: number) {
    const exists = checkLogsJson();
    if (exists) {
        const filepath = getLogsJson();
        let rawLogs = fs.readFileSync(filepath).toString();
        let logs = JSON.parse(rawLogs).logs;

        if (!logs[day - 1].shared) {
            logs[day - 1].shared = true;
            incrementSummaryShare();
            checkSharesMilestones();
            const sendLogs = { logs };
            try {
                fs.writeFileSync(filepath, JSON.stringify(sendLogs, null, 4));
            } catch (err) {
                console.log(err);
            }
        }
    }
}

export async function editLogEntry(
    dayNumber: number,
    title: string,
    description: string,
    links: Array<string>,
    editedHours: number
) {
    const exists = checkLogsJson();
    if (exists) {
        const filepath = getLogsJson();
        const rawLogs = fs.readFileSync(filepath).toString();
        let logs = JSON.parse(rawLogs).logs;
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
            setSummaryCurrentHours(editedHours);
        } else {
            summaryTotalHours -= currentLoggedHours;
            summaryTotalHours += editedHours;
            setSummaryTotalHours(summaryTotalHours);
        }
        const sendLogs = { logs };
        try {
            fs.writeFileSync(filepath, JSON.stringify(sendLogs, null, 4));
        } catch (err) {
            console.log(err);
            return;
        }
        await pushUpdatedLogs(true, dayNumber);
    }
}

export async function updateLogsMilestonesAndMetrics(milestones: Array<number>) {
    const exists = checkLogsJson();
    if (exists) {
        const metrics = getSessionCodetimeMetrics();
        const logDate = new Date();
        const filepath = getLogsJson();
        const rawLogs = fs.readFileSync(filepath).toString();
        let logs = JSON.parse(rawLogs).logs;

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

            const sendLogs = { logs };

            try {
                fs.writeFileSync(filepath, JSON.stringify(sendLogs, null, 4));
            } catch (err) {
                console.log(err);
                return;
            }
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
                logs[i].codetime_metrics.keystrokes = metrics.keystrokes;
                logs[i].codetime_metrics.lines_added = metrics.linesAdded;

                logs[i].milestones = logs[i].milestones.concat(milestones);
                const sendLogs = { logs };

                try {
                    fs.writeFileSync(filepath, JSON.stringify(sendLogs, null, 4));
                } catch (err) {
                    console.log(err);
                    return;
                }
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
}

export function getLogsHtml(): string {
    let file = getSoftwareDir();
    if (isWindows()) {
        file += "\\logs.html";
    } else {
        file += "/logs.html";
    }
    return file;
}

function getStyleColorsBasedOnMode(): any {
    const tempWindow: any = window;

    let cardTextColor = "#FFFFFF";
    let cardBackgroundColor = "rgba(255,255,255,0.05)";
    let cardMetricBarSidesColor = "rgba(255,255,255,0.20)";
    let cardToolTipColor = "rgba(109, 109, 109, .9)";
    let sharePath = "https://100-days-of-code.s3-us-west-1.amazonaws.com/Milestones/share.svg";
    let dropDownPath = "https://100-days-of-code.s3-us-west-1.amazonaws.com/Logs/dropDown.svg";
    let editLogCardColor = "#292929";
    if (tempWindow.activeColorTheme.kind === 1) {
        cardTextColor = "#444444";
        cardBackgroundColor = "rgba(0,0,0,0.10)";
        cardMetricBarSidesColor = "rgba(0,0,0,0.20)";
        cardToolTipColor = "rgba(165, 165, 165, .9)";
        sharePath = "https://100-days-of-code.s3-us-west-1.amazonaws.com/Milestones/shareLight.svg";
        dropDownPath = "https://100-days-of-code.s3-us-west-1.amazonaws.com/Logs/dropDownLight.svg";
        editLogCardColor = "#E5E5E5";
    }
    return {
        cardTextColor,
        cardBackgroundColor,
        cardMetricBarSidesColor,
        cardToolTipColor,
        sharePath,
        dropDownPath,
        editLogCardColor
    };
}

function generateShareUrl(
    day_number: number,
    title: string,
    hours: number,
    keystrokes: number,
    lines_added: number
): string {
    // Share link
    let shareText = [
        `Day ${day_number}/100 of 100DaysOfCode`,
        `${title}`,
        `Metrics:`,
        `Hours: ${hours}`,
        `Lines of Code: ${lines_added}`,
        `Keystrokes: ${keystrokes}`,
        `Data supplied from @software_hq’s 100 Days Of Code plugin`
    ].join("\n");
    const shareURI = encodeURI(shareText);
    return `https://twitter.com/intent/tweet?url=https%3A%2F%2Fwww.software.com%2F100-days-of-code&text=${shareURI}&hashtags=100DaysOfCode`;
}

function getFormattedDate(timestamp: number): string {
    const date = new Date(timestamp);
    const dayOfMonth = date.getDate();
    const month = date.getMonth() + 1;
    const year = date.getFullYear();
    return month + "/" + dayOfMonth + "/" + year;
}

function getLogsCardSummaryVariables(dayHours: number, dayKeystrokes: number, dayLinesAdded: number) {
    const summary = getSummaryObject();
    const hours = summary.hours + summary.currentHours;
    const keystrokes = summary.keystrokes + summary.currentKeystrokes;
    const lines = summary.lines_added + summary.currentLines;
    const days = summary.days;
    let avgHours = parseFloat((hours / days).toFixed(2));
    let avgKeystrokes = parseFloat((keystrokes / days).toFixed(2));
    let avgLines = parseFloat((lines / days).toFixed(2));

    let percentHours = (dayHours / avgHours) * 100;
    percentHours = Math.round(percentHours * 100) / 100;
    if (!avgHours || avgHours === 0) {
        percentHours = 100;
        avgHours = 0;
    }
    let percentKeystrokes = (dayKeystrokes / avgKeystrokes) * 100;
    percentKeystrokes = Math.round(percentKeystrokes * 100) / 100;
    if (!avgKeystrokes || avgKeystrokes === 0) {
        percentKeystrokes = 100;
        avgKeystrokes = 0;
    }
    let percentLines = (dayLinesAdded / avgLines) * 100;
    percentLines = Math.round(percentLines * 100) / 100;
    if (!avgLines || avgLines === 0) {
        percentLines = 100;
        avgLines = 0;
    }

    let barPxHours = Math.round(percentHours);
    let barColorHours = "00b4ee";
    if (barPxHours >= 100) {
        barPxHours = 100;
        barColorHours = "FD9808";
    }
    let barPxKeystrokes = Math.round(percentKeystrokes);
    let barColorKeystrokes = "00b4ee";
    if (barPxKeystrokes >= 100) {
        barPxKeystrokes = 100;
        barColorKeystrokes = "FD9808";
    }
    let barPxLines = Math.round(percentLines);
    let barColorLines = "00b4ee";
    if (barPxLines >= 100) {
        barPxLines = 100;
        barColorLines = "FD9808";
    }

    return {
        avgHours,
        percentHours,
        barPxHours,
        barColorHours,
        avgKeystrokes,
        percentKeystrokes,
        barPxKeystrokes,
        barColorKeystrokes,
        avgLines,
        percentLines,
        barPxLines,
        barColorLines
    };
}

function getLinksText(links: Array<string>): string {
    let linksText = "";
    for (let i = 0; i < links.length; i++) {
        linksText += [
            `\t\t\t\t\t\t<a class="cardLinkText" href="${links[i]}">`,
            `\t\t\t\t\t\t\t${links[i]}`,
            `\t\t\t\t\t\t</a>\n`
        ].join("\n");
    }
    return linksText;
}

function getMilestonesText(milestones: Array<number>): string {
    let milestonesText = "";
    const milestoneNum = milestones.length;
    for (let milestoneIndex = 0; milestoneIndex < 9; milestoneIndex++) {
        if (milestoneIndex % 3 === 0) {
            milestonesText += `\t\t\t\t\t<div class="cardMilestoneRow">\n`;
        }

        if (milestoneIndex < milestoneNum) {
            let milestoneId = milestones[milestoneIndex];
            let milestone = getMilestoneById(milestoneId);
            milestonesText += [
                `\t\t\t\t\t\t<div class="cardMilestone">`,
                `\t\t\t\t\t\t\t<span class="tooltiptext">`,
                `\t\t\t\t\t\t\t\t<div style="font-weight: bold;">${milestone.title}</div>`,
                `\t\t\t\t\t\t\t\t<div>${milestone.description}</div>`,
                `\t\t\t\t\t\t\t</span>`,
                `\t\t\t\t\t\t\t<img class="cardMilestoneIcon" src="${milestone.icon}" alt="">`,
                `\t\t\t\t\t\t</div>\n`
            ].join("\n");
        } else {
            milestonesText += [`\t\t\t\t\t\t<div class="cardMilestone">`, `\t\t\t\t\t\t</div>\n`].join("\n");
        }

        if (milestoneIndex % 3 === 2) {
            milestonesText += `\t\t\t\t\t</div>\n`;
        }
    }
    return milestonesText;
}

function getLogCard(
    day: Log,
    formattedDate: string,
    twitterShareUrl: string,
    shareIconLink: string,
    dropDownPath: string
): string {
    const {
        avgHours,
        percentHours,
        barPxHours,
        barColorHours,
        avgKeystrokes,
        percentKeystrokes,
        barPxKeystrokes,
        barColorKeystrokes,
        avgLines,
        percentLines,
        barPxLines,
        barColorLines
    } = getLogsCardSummaryVariables(
        day.codetime_metrics.hours,
        day.codetime_metrics.keystrokes,
        day.codetime_metrics.lines_added
    );
    const linksText = getLinksText(day.links);
    const milestonesText = getMilestonesText(day.milestones);
    return [
        `\t<div class="logCard">`,
        `\t\t<div class="cardHeader">`,
        `\t\t\t<div class="cardHeaderTextSection">`,
        `\t\t\t\t<div class="cardSubject">Day ${day.day_number}: ${day.title}</div>`,
        `\t\t\t\t<div class="cardTextGroup">`,
        `\t\t\t\t\t<div class="cardDateText">${formattedDate}</div>`,
        `\t\t\t\t</div>`,
        `\t\t\t</div>`,
        `\t\t\t<div class="cardHeaderButtonSection">`,
        `\t\t\t\t<a href="${twitterShareUrl}" title="Share this on Twitter"><button class="cardHeaderShareButton"><img class="cardHeaderShareButtonIcon" src=${shareIconLink}></button></a>`,
        `\t\t\t\t<button class="cardHeaderEditLogButton">Edit Log</button>`,
        `\t\t\t\t<button class="cardHeaderDropDownButton"><img class="cardHeaderShareButtonIcon" src=${dropDownPath}></button>`,
        `\t\t\t</div>`,
        `\t\t</div>`,
        `\t\t<div class="cardContent">`,
        `\t\t\t<div class="cardTextSection">`,
        `\t\t\t\t<div class="cardTextGroup">`,
        `\t\t\t\t\t<div class="cardText">${day.description}</div>`,
        `\t\t\t\t\t<br>`,
        `\t\t\t\t</div>`,
        `\t\t\t\t<div class="cardTextGroup">`,
        `\t\t\t\t\t<div>\n`,
        `${linksText}`,
        `\t\t\t\t\t</div>`,
        `\t\t\t\t</div>`,
        `\t\t\t</div>`,
        `\t\t\t<div class="cardMetricsSection">`,
        `\t\t\t\t<div class="cardMetricsTitle">Coding Metrics</div>`,
        `\t\t\t\t<br>`,
        `\t\t\t\t<div class='cardMetricGrid'>`,
        `\t\t\t\t\t<div class="cardMetric">`,
        `\t\t\t\t\t\t<div class="cardMetricText" style="font-size: 16px; margin-bottom: 5px;">Active Code Time</div>`,
        `\t\t\t\t\t\t<div class="cardMetricText" style="font-size: 20px; margin-bottom: 20px;">${day.codetime_metrics.hours}</div>`,
        `\t\t\t\t\t\t<div class="cardMetricText" style="font-size: 12px; margin-bottom: 5px;">${percentHours}% of Average</div>`,
        `\t\t\t\t\t\t<div class="cardMetricText" style="font-size: 12px; margin-bottom: 20px;">Average: ${avgHours} Hours</div>`,
        `\t\t\t\t\t\t<div class="cardMetricBarGroup">`,
        `\t\t\t\t\t\t\t<div class="cardMetricBarRight"></div>`,
        `\t\t\t\t\t\t\t<div class="cardMetricBarMiddle"></div>`,
        `\t\t\t\t\t\t\t<div class="cardMetricBarMiddle" style="width: ${barPxHours}px; background-color: #${barColorHours};"></div>`,
        `\t\t\t\t\t\t\t<div class="cardMetricBarLeft"></div>`,
        `\t\t\t\t\t\t</div>`,
        `\t\t\t\t\t</div>`,
        `\t\t\t\t\t<div class="cardMetric">`,
        `\t\t\t\t\t\t<div class="cardMetricText" style="font-size: 16px; margin-bottom: 5px;">Keystrokes</div>`,
        `\t\t\t\t\t\t<div class="cardMetricText" style="font-size: 20px; margin-bottom: 20px;">${day.codetime_metrics.keystrokes}</div>`,
        `\t\t\t\t\t\t<div class="cardMetricText" style="font-size: 12px; margin-bottom: 5px;">${percentKeystrokes}% of Average</div>`,
        `\t\t\t\t\t\t<div class="cardMetricText" style="font-size: 12px; margin-bottom: 20px;">Average: ${avgKeystrokes}</div>`,
        `\t\t\t\t\t\t<div class="cardMetricBarGroup">`,
        `\t\t\t\t\t\t\t<div class="cardMetricBarRight"></div>`,
        `\t\t\t\t\t\t\t<div class="cardMetricBarMiddle"></div>`,
        `\t\t\t\t\t\t\t<div class="cardMetricBarMiddle" style="width: ${barPxKeystrokes}px; background-color: #${barColorKeystrokes};"></div>`,
        `\t\t\t\t\t\t\t<div class="cardMetricBarLeft"></div>`,
        `\t\t\t\t\t\t</div>`,
        `\t\t\t\t\t</div>`,
        `\t\t\t\t\t<div class="cardMetric">`,
        `\t\t\t\t\t\t<div class="cardMetricText" style="font-size: 16px; margin-bottom: 5px;">Lines Added</div>`,
        `\t\t\t\t\t\t<div class="cardMetricText" style="font-size: 20px; margin-bottom: 20px;">${day.codetime_metrics.lines_added}</div>`,
        `\t\t\t\t\t\t<div class="cardMetricText" style="font-size: 12px; margin-bottom: 5px;">${percentLines}% of Average</div>`,
        `\t\t\t\t\t\t<div class="cardMetricText" style="font-size: 12px; margin-bottom: 20px;">Average: ${avgLines}</div>`,
        `\t\t\t\t\t\t<div class="cardMetricBarGroup">`,
        `\t\t\t\t\t\t\t<div class="cardMetricBarRight"></div>`,
        `\t\t\t\t\t\t\t<div class="cardMetricBarMiddle"></div>`,
        `\t\t\t\t\t\t\t<div class="cardMetricBarMiddle" style="width: ${barPxLines}px; background-color: #${barColorLines};"></div>`,
        `\t\t\t\t\t\t\t<div class="cardMetricBarLeft"></div>`,
        `\t\t\t\t\t\t</div>`,
        `\t\t\t\t\t</div>`,
        `\t\t\t\t</div>`,
        `\t\t\t</div>`,
        `\t\t\t<div class="cardMilestoneSection">`,
        `\t\t\t\t<div class="cardMilestoneTitle">Milestones</div>`,
        `\t\t\t\t<br>`,
        `\t\t\t\t<div class="cardMilestoneGrid">\n`,
        `${milestonesText}`,
        `\t\t\t\t\t</div>`,
        `\t\t\t\t</div>`,
        `\t\t\t</div>`,
        `\t\t</div>`,
        `\t</div>\n`
    ].join("\n");
}

export function getUpdatedLogsHtml(): string {
    const logsExists = checkLogsJson();

    let logs: Array<Log> = getAllLogObjects();

    // if in light mode
    const {
        cardTextColor,
        cardBackgroundColor,
        cardMetricBarSidesColor,
        cardToolTipColor,
        sharePath,
        dropDownPath,
        editLogCardColor
    } = getStyleColorsBasedOnMode();

    // CSS
    let logsHtml = "";
    let scriptHtml = "";

    let submittedLogToday: boolean;
    if (logs.length < 1 || (logs.length === 1 && !logs[0].day_number)) {
        logsHtml = `\t\t<h2 id='noLogs'>Log Daily Progress to see it here! --> <a id="addLog" href="Add Log">Add log</a></h2>`;
    } else {
        let mostRecentLog = logs[logs.length - 1];
        let logDate = new Date(mostRecentLog.date);
        let dateNow = new Date();
        submittedLogToday = compareDates(dateNow, logDate) && mostRecentLog.title !== "No Title";

        if (!submittedLogToday) {
            logsHtml += `\t\t<h2>Don't forget to submit your log today! --> <a id="addLog" href="Add Log">Add log</a></h2>\n`;
        }

        for (let i = logs.length - 1; i >= 0; i--) {
            if (!submittedLogToday && i === logs.length - 1) {
                continue;
            }

            const day = logs[i];

            const twitterShareUrl = generateShareUrl(
                day.day_number,
                day.title,
                day.codetime_metrics.hours,
                day.codetime_metrics.keystrokes,
                day.codetime_metrics.lines_added
            );

            const formattedDate = getFormattedDate(day.date);

            const shareIconLink = day.shared
                ? "https://100-days-of-code.s3-us-west-1.amazonaws.com/Milestones/alreadyShared.svg"
                : sharePath;

            logsHtml += getLogCard(day, formattedDate, twitterShareUrl, shareIconLink, dropDownPath);
        }
    }

    const templateVars = {
        logsHtml,
        cardTextColor,
        cardBackgroundColor,
        cardMetricBarSidesColor,
        cardToolTipColor,
        sharePath,
        dropDownPath,
        editLogCardColor
    };

    const templateString = fs.readFileSync(getLogsTemplate()).toString();
    const fillTemplate = function (templateString: string, templateVars: any) {
        return new Function("return `" + templateString + "`;").call(templateVars);
    };

    const logsHtmlContent = fillTemplate(templateString, templateVars);
    return logsHtmlContent;
}
