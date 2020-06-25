import { getSoftwareDir, isWindows, compareDates, getSoftwareSessionAsJson } from "./Util";
import fs = require("fs");
import { CodetimeMetrics } from "../models/CodetimeMetrics";
import { Log } from "../models/Log";
import {
    checkMilestonesJson,
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
    checkSummaryJson,
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
let dateLogMessage: Date;

export function getLogsJson(): string {
    let file = getSoftwareDir();
    if (isWindows()) {
        file += "\\logs.json";
    } else {
        file += "/logs.json";
    }
    return file;
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
    let retry = 5;
    let available = false;
    while (retry > 0) {
        try {
            available = await serverIsAvailable();
        } catch (err) {
            available = false;
        }
        retry--;
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
                } else {
                    // Wait 10 seconds before next try
                    setTimeout(() => {}, 10000);
                }
            });
            if (logs) {
                compareWithLocalLogs(logs);
                retry = 0;
                // exits out in the next iteration
            }
        } else {
            // Wait 10 seconds before next try
            setTimeout(() => {}, 10000);
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
            console.log("Logs updated from db");
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

    console.log("Logs updated from db");
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
    let retry = 5;
    let available = false;
    while (retry > 0) {
        try {
            available = await serverIsAvailable();
        } catch (err) {
            available = false;
        }
        retry--;
        if (available) {
            const jwt = getSoftwareSessionAsJson()["jwt"];
            const resp = await softwarePost("100doc/logs", toCreateLogs, jwt);
            const added: boolean = isResponseOk(resp);
            if (!added) {
                sentLogsDb = false;
            } else {
                sentLogsDb = true;
                toCreateLogs = [];
                break;
            }
        } else {
            sentLogsDb = false;
        }
        // Wait 10 seconds before next try
        setTimeout(() => {}, 10000);
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
    let retry = 5;
    let available = false;
    while (retry > 0) {
        try {
            available = await serverIsAvailable();
        } catch (err) {
            available = false;
        }
        retry--;
        if (available) {
            const jwt = getSoftwareSessionAsJson()["jwt"];
            const added: boolean = isResponseOk(await softwarePut("100doc/logs", toUpdateLogs, jwt));
            if (!added) {
                updatedLogsDb = false;
            } else {
                updatedLogsDb = true;
                toUpdateLogs = [];
                break;
            }
        } else {
            updatedLogsDb = false;
        }
        // Wait 10 seconds before next try
        setTimeout(() => {}, 10000);
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
        const metrics: Array<number> = getSessionCodetimeMetrics();
        // metrics of form [minutes, keystrokes, lines]
        if (metrics === []) {
            console.log("error fetching metrics");
            return;
        }
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
            log.codetime_metrics.hours = parseFloat((metrics[0] / 60).toFixed(1));
            log.codetime_metrics.keystrokes = metrics[1];
            log.codetime_metrics.lines_added = metrics[2];
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
                    parseFloat((metrics[0] / 60).toFixed(1))
                );
                logs[i].codetime_metrics.keystrokes = metrics[1];
                logs[i].codetime_metrics.lines_added = metrics[2];

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
                    (!dateLogMessage || compareDates(dateLogMessage, new Date())) &&
                    logs[i].codetime_metrics.hours > 0.3 &&
                    logs[i].title === "No Title"
                ) {
                    window
                        .showInformationMessage("Don't forget to add and share today's log.", "Add Log")
                        .then(selection => {
                            if (selection === "Add Log") {
                                commands.executeCommand("DoC.addLog");
                            }
                        });
                    dateLogMessage = new Date();
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

export function getUpdatedLogsHtmlString(): string {
    const logsExists = checkLogsJson();
    const milestonesExists = checkMilestonesJson();
    const summaryExists = checkSummaryJson();
    if (logsExists && milestonesExists && summaryExists) {
        const logFilepath = getLogsJson();
        const rawLogs = fs.readFileSync(logFilepath).toString();
        let logs = JSON.parse(rawLogs).logs;

        // if in light mode
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

        // CSS
        let htmlString = [
            `<html>`,
            `<head>`,
            `\t<title>`,
            `\t\tLogs`,
            `\t</title>`,
            `</head>`,
            `<style>`,
            `\tbody{`,
            `\t\tfont-family: sans-serif;`,
            `\t\tcolor: ${cardTextColor}`,
            `\t}`,
            `\t.logCard {`,
            `\t\tdisplay: inline-block;`,
            `\t\tbackground: ${cardBackgroundColor};`,
            `\t\twidth: 830px;`,
            `\t\tbox-sizing: border-box;`,
            `\t\tborder-radius: 1px;`,
            `\t\tpadding: 10px;`,
            `\t\tmargin-bottom: 20px;`,
            `\t}`,
            // Log Text Types
            `\t.cardText {`,
            `\t\tmax-width: 100%;`,
            `\t\tfont-style: normal;`,
            `\t\tfont-weight: normal;`,
            `\t\tfont-size: 14px;`,
            `\t\tline-height: 128.91%;`,
            `\t\tdisplay: flex;`,
            `\t\tpadding-left: 10px;`,
            `\t\talign-items: center;`,
            `\t\tcolor: ${cardTextColor};`,
            `\t}`,
            `\t.cardLinkText {`,
            `\t\tfont-style: normal;`,
            `\t\tfont-weight: normal;`,
            `\t\tfont-size: 14px;`,
            `\t\tline-height: 128.91%;`,
            `\t\tdisplay: flex;`,
            `\t\tpadding-left: 10px;`,
            `\t\talign-items: center;`,
            `\t\tmargin-bottom: 8px;`,
            `\t\tcolor: #999999;`,
            `\t}`,
            `\t.cardTextEditInput {`,
            `\t\tposition: absolute;`,
            `\t\ttop: 0px;`,
            `\t\tfont-size: 14px;`,
            `\t\tborder-radius: 1px;`,
            `\t\tpadding-left: 5px;`,
            `\t\tpadding-right: 5px;`,
            `\t\tborder-color: rgba(0, 0, 0, 0);`,
            `\t\tbackground-color: ${cardBackgroundColor};`,
            `\t\tcolor: ${cardTextColor};`,
            `\t\ttransform: translate(8px, 30px);`,
            `\t\tvisibility: hidden;`,
            `\t\tresize: none;`,
            `\t}`,
            `\t.cardTextTitleEditInput{`,
            `\t\tposition: absolute;`,
            `\t\ttop: 0px;`,
            `\t\tfont-size: 14px;`,
            `\t\tborder-radius: 1px;`,
            `\t\tpadding-left: 5px;`,
            `\t\tpadding-right: 5px;`,
            `\t\tborder-color: rgba(0, 0, 0, 0);`,
            `\t\tbackground-color: ${cardBackgroundColor};`,
            `\t\tcolor: ${cardTextColor};`,
            `\t\ttransform: translate(50px, -20px);`,
            `\t\tvisibility: hidden;`,
            `\t\tresize: none;`,
            `\t}`,
            `\t.cardSubject {`,
            `\t\tfont-style: normal;`,
            `\t\tfont-weight: bold;`,
            `\t\tfont-size: 16px;`,
            `\t\tline-height: 128.91%;`,
            `\t\tpadding-left: 10px;`,
            `\t\tdisplay: flex;`,
            `\t\tcolor: ${cardTextColor};`,
            `\t}`,
            `\t.cardDateText {`,
            `\t\tfont-style: normal;`,
            `\t\tfont-weight: normal;`,
            `\t\tfont-size: 14px;`,
            `\t\tline-height: 128.91%;`,
            `\t\tdisplay: flex;`,
            `\t\talign-items: center;`,
            `\t\tpadding-left: 10px;`,
            `\t\tcolor: #888888;`,
            `\t\tvisibility: visible;`,
            `\t}`,
            `\t.cardTextGroup {`,
            `\t\twidth: 100%;`,
            `\t\tposition: relative;`,
            `\t\tvertical-align: top;`,
            `\t}`,
            // Card Header
            `\t.cardHeader {`,
            `\t\tposition: relative;`,
            `\t\twidth: 100%;`,
            `\t\theight: 40px;`,
            `\t\tdisplay: inline-flex;`,
            `\t}`,
            `\t.cardHeaderTextSection {`,
            `\t\t/* background-color: red; */`,
            `\t\tposition: absolute;`,
            `\t\tleft: 0px;`,
            `\t}`,
            `\t.cardHeaderButtonSection {`,
            `\t\t/* background-color: blue; */`,
            `\t\tposition: absolute;`,
            `\t\tdisplay: inline-flex;`,
            `\t\theight: 100%;`,
            `\t\tright: 3px;`,
            `\t\tvertical-align: middle;`,
            `\t\talign-items: center;`,
            `\t}`,
            `\t.cardHeaderEditLogButton {`,
            `\t\tcursor: pointer;`,
            `\t\tfont-style: normal;`,
            `\t\tfont-weight: bold;`,
            `\t\tfont-size: 18px;`,
            `\t\ttext-align: center;`,
            `\t\tcolor: ${cardTextColor};`,
            `\t\tbackground-color: ${cardBackgroundColor};`,
            `\t\tborder-radius: 1px;`,
            `\t\tborder-color: rgba(0,0,0,0);`,
            `\t\tpadding: 5px;`,
            `\t\tvertical-align: middle;`,
            `\t\tvisibility: hidden;`,
            `\t\tmargin: 5px;`,
            `\t}`,
            `\t.cardHeaderShareButton {`,
            `\t\tcursor: pointer;`,
            `\t\tposition: absolute;`,
            `\t\tbackground-color: rgba(0,0,0,0);`,
            `\t\tborder-color: rgba(0,0,0,0);`,
            `\t\ttransform: translate(50px, -18px);`,
            `\t\tmargin: 5px;`,
            `\t}`,
            `\t.cardHeaderShareButtonIcon {`,
            `\t\twidth: 22px;`,
            `\t\theight: 22px;`,
            `\t}`,
            `\t.cardHeaderDropDownButton {`,
            `\t\tcursor: pointer;`,
            `\t\tbackground-color: rgba(0,0,0,0);`,
            `\t\tborder-color: rgba(0,0,0,0);`,
            `\t\ttransform: rotate(180deg);`,
            `\t\tmargin: 5px;`,
            `\t}`,
            `\tbutton:focus {outline:0;}`,
            `\t.cardContent {`,
            `\t\tmax-height: 0;`,
            `\t\toverflow: hidden;`,
            `\t\ttransition: max-height 0.2s ease-out;`,
            `\t}`,
            // Text Section
            `\t.cardTextSection {`,
            `\t\twidth: 800px;`,
            `\t\tdisplay: inline-block;`,
            `\t\tvertical-align: top;`,
            `\t\tmargin-bottom: 20px;`,
            `\t\tmargin-top: 20px;`,
            `\t}`,
            // Metrics
            `\t.cardMetricsSection {`,
            `\t\t/* background-color: red; */`,
            `\t\tdisplay: inline-block;`,
            `\t\tvertical-align: top;`,
            `\t\tmargin-top: 20px;`,
            `\t}`,
            `\t.cardMetricsTitle {`,
            `\t\twidth: 100%;`,
            `\t\ttext-align: left;`,
            `\t\tfont-style: normal;`,
            `\t\tfont-weight: bold;`,
            `\t\tfont-size: 16px;`,
            `\t\tline-height: 128.91%;`,
            `\t\tcolor: ${cardTextColor};`,
            `\t\tpadding-left: 10px;`,
            `\t\tmargin-bottom: 3px;`,
            `\t}`,
            `\t.cardMetricGrid {`,
            `\t\twidth: 600px;`,
            `\t\tjustify-content: space-around;`,
            `\t\tdisplay: flex;`,
            `\t}`,
            `\t.cardMetric {`,
            `\t\twidth: 30%;`,
            `\t\tdisplay: inline-flex;`,
            `\t\talign-items: center;`,
            `\t\tbackground: ${cardBackgroundColor};`,
            `\t\tborder-radius: 1px;`,
            `\t\tdisplay: flex;`,
            `\t\tflex-direction: column;`,
            `\t\tjustify-content: space-around;`,
            `\t\tpadding-top: 15px;`,
            `\t\tpadding-bottom: 15px;`,
            `\t}`,
            `\t.cardMetricText {`,
            `\t\t/* background-color: darkgreen; */`,
            `\t\twidth: 100%;`,
            `\t\tfont-style: normal;`,
            `\t\tfont-weight: bold;`,
            `\t\tfont-size: 12px;`,
            `\t\tline-height: 128.91%;`,
            `\t\ttext-align: center;`,
            `\t\tcolor: ${cardTextColor};`,
            `\t}`,
            `\t.cardMetricBarGroup{`,
            `\t\tposition: relative;`,
            `\t\twidth: 120px;`,
            `\t\theight: 40px;`,
            `\t}`,
            `\t.cardMetricBarLeft{`,
            `\t\tposition: absolute;`,
            `\t\twidth: 10px;`,
            `\t\theight: 40px;`,
            `\t\ttop: 0px;`,
            `\t\tleft: 0px;`,
            `\t\tborder-radius: 1px;`,
            `\t\tbackground-color: ${cardMetricBarSidesColor}`,
            `\t}`,
            `\t.cardMetricBarRight{`,
            `\t\tposition: absolute;`,
            `\t\twidth: 10px;`,
            `\t\theight: 40px;`,
            `\t\ttop: 0px;`,
            `\t\tleft: 110px;`,
            `\t\tborder-radius: 1px;`,
            `\t\tbackground-color: ${cardMetricBarSidesColor}`,
            `\t}`,
            `\t.cardMetricBarMiddle{`,
            `\t\tposition: absolute;`,
            `\t\twidth: 100px;`,
            `\t\theight: 20px;`,
            `\t\ttop: 10px;`,
            `\t\tleft: 10px;`,
            `\t\tbackground-color: ${cardBackgroundColor}`,
            `\t}`,
            // Milestones
            `\t.cardMilestoneSection {`,
            `\t\tdisplay: inline-block;`,
            `\t\tvertical-align: top;`,
            `\t\twidth: 200px;`,
            `\t\theight: 230px;`,
            `\t\tmargin-top: 20px;`,
            `\t}`,
            `\t.cardMilestoneTitle {`,
            `\t\twidth: 200px;`,
            `\t\tfont-style: normal;`,
            `\t\tfont-weight: bold;`,
            `\t\tfont-size: 16px;`,
            `\t\tline-height: 128.91%;`,
            `\t\ttext-align: left;`,
            `\t\tpadding-left: 8px;`,
            `\t\tcolor: ${cardTextColor};`,
            `\t}`,
            `\t.cardMilestoneGrid {`,
            `\t\twidth: 200px;`,
            `\t\theight: 200px;`,
            `\t\tdisplay: flex;`,
            `\t\tflex-direction: column;`,
            `\t\tjustify-content: space-around;`,
            `\t}`,
            `\t.cardMilestoneRow {`,
            `\t\twidth: 100%;`,
            `\t\tjustify-content: space-around;`,
            `\t\tdisplay: flex;`,
            `\t}`,
            `\t.cardMilestone {`,
            `\t\tposition: relative;`,
            `\t\twidth: 55px;`,
            `\t\theight: 55px;`,
            `\t\tbackground: ${cardBackgroundColor};`,
            `\t\tborder-radius: 1px;`,
            `\t\tdisplay: inline-flex;`,
            `\t\talign-items: center;`,
            `\t}`,
            `\t.cardMilestoneIcon{`,
            `\t\twidth: 35px;`,
            `\t\theight: 35px;`,
            `\t\tposition: absolute;`,
            `\t\ttop: 50%;`,
            `\t\tleft: 50%;`,
            `\t\ttransform: translate(-50%, -50%);`,
            `\t}`,
            `\t.cardMilestone .tooltiptext {`,
            `\t\tvisibility: hidden;`,
            `\t\ttop: 8px;`,
            `\t\tright: 105%;`,
            `\t\tbackground-color: ${cardToolTipColor};`,
            `\t\tbackground-blend-mode: darken;`,
            `\t\tborder-radius: 3px;`,
            `\t\tcolor: ${cardTextColor};`,
            `\t\ttext-align: center;`,
            `\t\twhite-space: nowrap;`,
            `\t\tpadding: 5px;`,
            `\t\tposition: absolute;`,
            `\t\tz-index: 1;`,
            `\t}`,
            `\t.cardMilestone:hover .tooltiptext {`,
            `\t\tvisibility: visible;`,
            `\t}`,
            // Edit Logs Card
            `\t#editLogCard {`,
            `\t\tposition: fixed;`,
            `\t\tz-index: 1;`,
            `\t\tleft: 0;`,
            `\t\ttop: 0;`,
            `\t\twidth: 100%;`,
            `\t\theight: 100%;`,
            `\t\toverflow: auto;`,
            `\t\tbackground-color: rgba(0,0,0,0.2);`,
            `\t\tvisibility: hidden;`,
            `}`,
            `\t#editLogCardContent {`,
            `\t\tposition: absolute;`,
            `\t\twidth: 450px;`,
            `\t\theight: 520px;`,
            `\t\ttop: 50%;`,
            `\t\tmargin-top: -260px;`,
            `\t\tleft: 50%;`,
            `\t\tmargin-left: -225px;`,
            `\t\tbackground: ${editLogCardColor};`,
            `\t\tborder-radius: 3px;`,
            `\t}`,
            `\t/* Headings */`,
            `\t#head1 {`,
            `\t\tmargin-top: 10px;`,
            `\t\tmargin-left: 10px;`,
            `\t\tfont-size: 23px;`,
            `\t\tline-height: 30px;`,
            `\t\tfont-weight: 600;`,
            `\t\tcolor: ${cardTextColor}`,
            `\t}`,
            `\t.head2 {`,
            `\t\tmargin-top: 10px;`,
            `\t\tmargin-left: 10px;`,
            `\t\tfont-size: 14px;`,
            `\t\tcolor: #919eab;`,
            `\t\tfont-weight: 500;`,
            `\t}`,
            `\t/* Textboxes */`,
            `\t.text {`,
            `\t\tmargin-left: 10px;`,
            `\t\tmargin-right: 10px;`,
            `\t\tmargin-top: 5px;`,
            `\t\tmargin-bottom: 5px;`,
            `\t\twidth: 415px;`,
            `\t\tfont-size: 16px;`,
            `\t\tborder-radius: 3px;`,
            `\t\tpadding-left: 5px;`,
            `\t\tpadding-right: 5px;`,
            `\t\tborder-color: rgba(0, 0, 0, 0);`,
            `\t\tbackground-color: ${cardBackgroundColor};`,
            `\t\tcolor: ${cardTextColor};`,
            `\t\tresize: none;`,
            `\t}`,
            `\t#editLogsHoursSelect {`,
            `\t\twidth: 40px;`,
            `\t}`,
            `\t.hoursText {`,
            `\t\tmargin-left: -10px;`,
            `\t\tfont-size: 16px;`,
            `\t\tline-height: 20px;`,
            `\t\tcolor: ${cardTextColor};`,
            `\t}`,
            `\t.metricsText {`,
            `\t\tmargin-top: 5px;`,
            `\t\tmargin-left: 10px;`,
            `\t\tmargin-right: 15px;`,
            `\t\tfont-size: 12px;`,
            `\t\tcolor: #919eab;`,
            `\t\tfont-weight: 500;`,
            `\t}`,
            `\t/* Buttons */`,
            `\t.buttons {`,
            `\t\tmargin-top: 30px;`,
            `\t\tmargin-left: 10px;`,
            `\t}`,
            `\t#editLogCancelButton {`,
            `\t\tcursor: pointer;`,
            `\t\tfont-size: 16px;`,
            `\t\tline-height: 25px;`,
            `\t\tcolor: ${cardTextColor};`,
            `\t\tbackground-color: rgba(0, 0, 0, 0);`,
            `\t\tborder-color: rgba(0, 0, 0, 0);`,
            `\t\tborder-radius: 3px;`,
            `\t\tmargin-left: 10px;`,
            `\t\tmargin-bottom: 15px;`,
            `\t}`,
            `\t#editLogSubmitButton {`,
            `\t\tcursor: pointer;`,
            `\t\tfont-size: 16px;`,
            `\t\tline-height: 25px;`,
            `\t\tcolor: ${cardTextColor};`,
            `\t\tbackground: #00b4ee;`,
            `\t\tborder: 3px solid #00b4ee;`,
            `\t\tbox-sizing: border-box;`,
            `\t\tborder-radius: 3px;`,
            `\t\tmargin-bottom: 15px;`,
            `\t}`,
            `</style>`,
            `<body>`,
            `\t<h1>Logs</h1>\n`
        ].join("\n");

        let submittedLogToday: boolean;
        if (logs.length < 1 || (logs.length === 1 && !logs[0].day_number)) {
            htmlString += [
                `\t\t<h2 id='noLogs'>Log Daily Progress to see it here! --> <a id="addLog" href="Add Log">Add log</a></h2></body>`,
                `\t<script>\n\tconst vscode = acquireVsCodeApi();`,
                `\tconst addLog = document.getElementById("addLog");`,
                `\tif(addLog){`,
                `\t\taddLog.addEventListener("click", function(){`,
                `\t\t\tvscode.postMessage({command: "addLog"});`,
                `\t\t});}\n\t</script>\n</html>`
            ].join("\n");
        } else {
            let mostRecentLog = logs[logs.length - 1];
            let logDate = new Date(mostRecentLog.date);
            let dateNow = new Date();
            submittedLogToday = compareDates(dateNow, logDate) && mostRecentLog.title !== "No Title";

            if (!submittedLogToday) {
                htmlString += `\t\t<h2>Don't forget to submit your log today! --> <a id="addLog" href="Add Log">Add log</a></h2>\n`;
            }

            for (let i = logs.length - 1; i >= 0; i--) {
                if (!submittedLogToday && i === logs.length - 1) {
                    continue;
                }

                const day = logs[i];

                // Share link
                let shareText = [
                    `Day ${day.day_number}/100 of 100DaysOfCode`,
                    `What I worked on: ${day.title}`,
                    ``,
                    `Metrics: Hours: ${day.codetime_metrics.hours}`,
                    `Lines of Code: ${day.codetime_metrics.lines_added}`,
                    `Keystrokes: ${day.codetime_metrics.keystrokes}`,
                    `Data supplied from @software_hq’s 100 Days Of Code plugin`
                ].join("\n");
                const shareURI = encodeURI(shareText);
                const twitterShareUrl = `https://twitter.com/intent/tweet?url=https%3A%2F%2Fwww.software.com%2F100-days-of-code&text=${shareURI}&hashtags=100DaysOfCode`;

                const unix_timestamp = day.date;

                //Getting the date
                const date = new Date(unix_timestamp);
                const dayOfMonth = date.getDate();
                const month = date.getMonth() + 1;
                const year = date.getFullYear();
                const formattedTime = month + "/" + dayOfMonth + "/" + year;

                let descriptionRows = day.description === "" ? 2 : 3;

                const shareIconLink = day.shared
                    ? "https://100-days-of-code.s3-us-west-1.amazonaws.com/Milestones/alreadyShared.svg"
                    : sharePath;

                // Header and description
                htmlString += [
                    `\t<div class="logCard">`,
                    `\t\t<div class="cardHeader">`,
                    `\t\t\t<div class="cardHeaderTextSection">`,
                    `\t\t\t\t<div class="cardSubject">Day ${day.day_number}: ${day.title}</div>`,
                    `\t\t\t\t<div class="cardTextGroup">`,
                    `\t\t\t\t\t<div class="cardDateText">${formattedTime}</div>`,
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
                    `\t\t\t\t\t<div>\n`
                ].join("\n");

                // Links
                let linksText = "";
                for (let _j = 0; _j < day.links.length; _j++) {
                    htmlString += [
                        `\t\t\t\t\t\t<a class="cardLinkText" href="${day.links[_j]}">`,
                        `\t\t\t\t\t\t\t${day.links[_j]}`,
                        `\t\t\t\t\t\t</a>\n`
                    ].join("\n");
                    linksText += day.links[_j] + ", ";
                }

                const summary = getSummaryObject();
                const hours = summary.hours + summary.currentHours;
                const keystrokes = summary.keystrokes + summary.currentKeystrokes;
                const lines = summary.lines_added + summary.currentLines;
                const days = summary.days;
                let avgHours = parseFloat((hours / days).toFixed(2));
                let avgKeystrokes = parseFloat((keystrokes / days).toFixed(2));
                let avgLines = parseFloat((lines / days).toFixed(2));

                let percentHours = (day.codetime_metrics.hours / avgHours) * 100;
                percentHours = Math.round(percentHours * 100) / 100;
                if (!avgHours || avgHours === 0) {
                    percentHours = 100;
                    avgHours = 0;
                }
                let percentKeystrokes = (day.codetime_metrics.keystrokes / avgKeystrokes) * 100;
                percentKeystrokes = Math.round(percentKeystrokes * 100) / 100;
                if (!avgKeystrokes || avgKeystrokes === 0) {
                    percentKeystrokes = 100;
                    avgKeystrokes = 0;
                }
                let percentLines = (day.codetime_metrics.lines_added / avgLines) * 100;
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

                // Daily code time metrics
                htmlString += [
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
                    `\t\t\t\t<div class="cardMilestoneGrid">\n`
                ].join("\n");

                // Milestones
                const milestoneNum = day.milestones.length;
                for (let milestoneIndex = 0; milestoneIndex < 9; milestoneIndex++) {
                    if (milestoneIndex % 3 === 0) {
                        htmlString += `\t\t\t\t\t<div class="cardMilestoneRow">\n`;
                    }

                    if (milestoneIndex < milestoneNum) {
                        let milestoneId = day.milestones[milestoneIndex];
                        let milestone = getMilestoneById(milestoneId);
                        htmlString += [
                            `\t\t\t\t\t\t<div class="cardMilestone">`,
                            `\t\t\t\t\t\t\t<span class="tooltiptext">`,
                            `\t\t\t\t\t\t\t\t<div style="font-weight: bold;">${milestone.title}</div>`,
                            `\t\t\t\t\t\t\t\t<div>${milestone.description}</div>`,
                            `\t\t\t\t\t\t\t</span>`,
                            `\t\t\t\t\t\t\t<img class="cardMilestoneIcon" src="${milestone.icon}" alt="">`,
                            `\t\t\t\t\t\t</div>\n`
                        ].join("\n");
                    } else {
                        htmlString += [`\t\t\t\t\t\t<div class="cardMilestone">`, `\t\t\t\t\t\t</div>\n`].join("\n");
                    }

                    if (milestoneIndex % 3 === 2) {
                        htmlString += `\t\t\t\t\t</div>\n`;
                    }
                }

                htmlString += [`\t\t\t\t\t</div>`, `\t\t\t\t</div>`, `\t\t\t</div>`, `\t\t</div>`, `\t</div>\n`].join(
                    "\n"
                );
            }
            // Edit logs card
            htmlString += [
                `\t<div id="editLogCard">`,
                `\t\t<div id="editLogCardContent">`,
                `\t\t\t<div id="head1">Edit Log</div>`,
                `\t\t\t<div id="editLogsDayAndDate" class="head2"></div>`,
                `\t\t\t<div class="head2">Title</div>`,
                `\t\t\t<textarea`,
                `\t\t\t\tid="editLogsTitle"`,
                `\t\t\t\tclass="text"`,
                `\t\t\t\tplaceholder="Title for today's work log"`,
                `\t\t\t\trows="1"`,
                `\t\t\t></textarea>`,
                `\t\t\t<div class="head2">Description</div>`,
                `\t\t\t<textarea`,
                `\t\t\t\tid="editLogsDescription"`,
                `\t\t\t\tclass="text"`,
                `\t\t\t\tplaceholder="Description for today's work log"`,
                `\t\t\t\trows="4"`,
                `\t\t\t></textarea>`,
                `\t\t\t`,
                `\t\t\t<div class="head2">`,
                `\t\t\t\tLink(s) to Today's Work (Separate links with commas)`,
                `\t\t\t</div>`,
                `\t\t\t<textarea`,
                `\t\t\t\tid="editLogsLinks"`,
                `\t\t\t\tclass="text"`,
                `\t\t\t\tplaceholder="Links to resources, git commits, working projects, etc.."`,
                `\t\t\t\trows="3"`,
                `\t\t\t></textarea>`,
                `\t\t\t`,
                `\t\t\t<div class="head2">Hours coded</div>`,
                `\t\t\t<input type="number" class="text" id="editLogsHoursSelect" value="3.5" />`,
                `\t\t\t<span class="hoursText">hours</span>`,
                `\t\t\t`,
                `\t\t\t<div class="metricsText" id="metricsText">`,
                `\t\t\t\tYou’ve logged 1.2 hours, 232 keystrokes, and 120 lines of code so far`,
                `\t\t\t\ttoday based on our Code Time plugin.`,
                `\t\t\t</div>`,
                `\t\t\t`,
                `\t\t\t<div class="buttons">`,
                `\t\t\t\t<button id="editLogSubmitButton">Submit</button>`,
                `\t\t\t\t<button id="editLogCancelButton">Cancel</button>`,
                `\t\t\t</div>`,
                `\t\t</div>`,
                `\t</div>`
            ].join("\n");

            // scripts
            htmlString += [
                `</body>`,
                `<script>`,
                `\tconst vscode = acquireVsCodeApi();`,
                // add log
                `\tconst addLog = document.getElementById("addLog");`,
                `\tif(addLog){`,
                `\t\taddLog.addEventListener("click", function(){`,
                `\t\t\tvscode.postMessage({command: "addLog"});`,
                `\t\t});}\n`,
                //drop down button
                `\tvar dropDownButtons = document.getElementsByClassName("cardHeaderDropDownButton");\n`,
                `\tfor (let i = 0; i < dropDownButtons.length; i++) {`,
                `\t\tdropDownButtons[i].addEventListener("click", function () {`,
                `\t\t\tvar shareButton = this.parentNode.getElementsByClassName("cardHeaderShareButton")[0];`,
                `\t\t\tvar editButton = this.parentNode.getElementsByClassName("cardHeaderEditLogButton")[0];`,
                `\t\t\tvar dropDownIcon = this;`,
                `\t\t\tvar content = this.parentNode.parentNode.nextElementSibling;`,
                `\t\t\tif (content.style.maxHeight) {`,
                `\t\t\t\tcontent.style.maxHeight = null;`,
                `\t\t\t\tdropDownIcon.style.transform = 'rotate(180deg)';`,
                `\t\t\t\teditButton.style.visibility = 'hidden';`,
                `\t\t\t\tshareButton.style.transform = 'translate(50px, -18px)'`,
                `\t\t\t} else {`,
                `\t\t\t\tcontent.style.maxHeight = content.scrollHeight + "px";`,
                `\t\t\t\tdropDownIcon.style.transform = 'rotate(0deg)';`,
                `\t\t\t\teditButton.style.visibility = 'visible';`,
                `\t\t\t\tshareButton.style.transform = 'translate(-48px, -18px)'`,
                `\t\t\t}`,
                `\t\t});`,
                `\t}`,
                // Edit Logs Button
                `\tvar editButtons = document.getElementsByClassName("cardHeaderEditLogButton");`,
                `\t`,
                `\tfor (let i = 0; i < editButtons.length; i++) {`,
                `\t\teditButtons[i].addEventListener("click", function () {`,
                `\t\t\tconst title = this.parentNode.parentNode.getElementsByClassName("cardSubject")[0].innerHTML;`,
                `\t\t\tlet titleSplit = title.split(" ");`,
                `\t\t\ttitleSplit.shift();`,
                `\t\t\tlet dayNumber = titleSplit[0];`,
                `\t\t\tdayNumber = dayNumber.substring(0, dayNumber.length-1);`,
                `\t\t\tconst date = this.parentNode.parentNode.getElementsByClassName("cardDateText")[0].innerHTML;`,
                `\t\t\tconst dateList = date.split("/");`,
                `\t\t\tconst monthNames = [ "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December" ];`,
                `\t\t\tconst dateString = monthNames[dateList[0]-1] + ' ' + dateList[1] + ', ' + dateList[2];`,
                `\t\t\ttitleSplit.shift();`,
                `\t\t\tconst titleString = titleSplit.join(" ");`,
                `\t\t\tconst descAndLinks = this.parentNode.parentNode.parentNode.getElementsByClassName("cardText");`,
                `\t\t\tconst descriptionString = descAndLinks[0].innerHTML;`,
                `\t\t\tconst linksElementArray = this.parentNode.parentNode.parentNode.getElementsByClassName("cardLinkText");`,
                `\t\t\tlet linksArray = [];`,
                `\t\t\tfor(let _j = 0; _j < linksElementArray.length; _j++){`,
                `\t\t\t\tlinksArray.push(linksElementArray[_j].innerHTML.trim());`,
                `\t\t\t}`,
                `\t\t\tconst linksString = linksArray.join(", ");`,
                `\t\t\tconst hours = this.parentNode.parentNode.parentNode.getElementsByClassName("cardMetricText")[1].innerHTML;`,
                `\t\t\tconst keystrokes = this.parentNode.parentNode.parentNode.getElementsByClassName("cardMetricText")[5].innerHTML;`,
                `\t\t\tconst linesAdded = this.parentNode.parentNode.parentNode.getElementsByClassName("cardMetricText")[9].innerHTML;`,
                `\t\t\tlet editLogsForm = document.getElementById("editLogCard");`,
                `\t\t\teditLogsForm.style.visibility = 'visible';`,
                `\t\t\tlet dayAndDateTitle = document.getElementById("editLogsDayAndDate");`,
                `\t\t\tdayAndDateTitle.innerHTML = 'Day ' + dayNumber + ' |  ' + dateString;`,
                `\t\t\tlet titleField = document.getElementById("editLogsTitle");`,
                `\t\t\ttitleField.value = titleString;`,
                `\t\t\tlet descriptionField = document.getElementById("editLogsDescription");`,
                `\t\t\tdescriptionField.value = descriptionString;`,
                `\t\t\tlet linksField = document.getElementById("editLogsLinks");`,
                `\t\t\tlinksField.value = linksString;`,
                `\t\t\tlet hoursField = document.getElementById("editLogsHoursSelect");`,
                `\t\t\thoursField.value = hours;`,
                `\t\t\tlet metricsText = document.getElementById("metricsText");`,
                `\t\t\tmetricsText.innerHTML = 'You’ve logged ' + hours + ' hours, ' + keystrokes + ' keystrokes, and ' + linesAdded + ' lines of code based on our Code Time plugin.';`,
                `\t\t});`,
                `\t}`,
                // Cancel Button
                `\tvar cancelButton = document.getElementById("editLogCancelButton");`,
                `\tcancelButton.addEventListener("click", function () {`,
                `\t\tlet editLogsForm = document.getElementById("editLogCard");`,
                `\t\teditLogsForm.style.visibility = 'hidden';`,
                `\t});`,
                // Submit Button
                `\tvar submitButton = document.getElementById("editLogSubmitButton");`,
                `\tsubmitButton.addEventListener("click", function () {`,
                `\t\tlet dayAndDateTitle = document.getElementById("editLogsDayAndDate");`,
                `\t\tconst dayNumber = dayAndDateTitle.innerHTML.split(" ")[1];`,
                `\t\tlet titleField = document.getElementById("editLogsTitle");`,
                `\t\tconst title = titleField.value;`,
                `\t\tlet descriptionField = document.getElementById("editLogsDescription");`,
                `\t\tconst description = descriptionField.value;`,
                `\t\tlet linksField = document.getElementById("editLogsLinks");`,
                `\t\tconst links = linksField.value.replace(" ", "").split(",");`,
                `\t\tconst logCards = document.getElementsByClassName("logCard");`,
                `\t\tlet logCard = logCards[logCards.length - dayNumber];`,
                `\t\tlet cardHeader = logCard.firstChild.nextSibling;`,
                `\t\tlet dayAndTitle = cardHeader.firstChild.nextSibling.firstChild.nextSibling;`,
                `\t\tdayAndTitle.innerHTML = 'Day ' + dayNumber + ': ' + title;`,
                `\t\tlet cardContent = cardHeader.nextSibling.nextSibling;`,
                `\t\tlet cardDescription = cardContent.firstChild.nextSibling.firstChild.nextSibling.firstChild.nextSibling;`,
                `\t\tlet linksRoot = cardContent.firstChild.nextSibling.firstChild.nextSibling.nextSibling.nextSibling.firstChild.nextSibling;`,
                `\t\tlet allOldLinks = linksRoot.childNodes; `,
                `\t\tfor(let _j = allOldLinks.length - 1; _j >= 0; _j--){`,
                `\t\t\tallOldLinks[_j].remove(); `,
                `\t\t} `,
                `\t\tif(links.length > 0){`,
                `\t\t\tfor(let _j = 0; _j < links.length; _j++) {`,
                `\t\t\t\tlet link = links[_j]; `,
                // `\t\t\t\tlet linkDisplay = link.replace('http://','').replace('https://','').split(/[/?#]/)[0];`,
                `\t\t\t\tvar a = document.createElement("a"); `,
                `\t\t\t\ta.className = "cardLinkText"; `,
                `\t\t\t\ta.href = link; `,
                `\t\t\t\ta.innerHTML = link; `,
                `\t\t\t\tlinksRoot.append(a); `,
                `\t\t\t} `,
                `\t\t} else {`,
                `\t\t\tvar a = document.createElement("a"); `,
                `\t\t\ta.className = "cardText"; `,
                `\t\t\tvar div = document.createElement("div"); `,
                `\t\t\tvar text = document.createTextNode("No Links added"); `,
                `\t\t\ta.append(div); `,
                `\t\t\tdiv.append(text); `,
                `\t\t\tlinksRoot.append(a); `,
                `\t\t}`,
                `\t\tconst editHoursAmount = parseFloat(document.getElementById("editLogsHoursSelect").value);`,
                `\t\tlet cardHoursMetric = logCard.getElementsByClassName("cardMetricText")[1];`,
                `\t\tlet cardHoursAveragePercent = logCard.getElementsByClassName("cardMetricText")[2];`,
                `\t\tlet cardAverageHoursMetric = parseFloat(logCard.getElementsByClassName("cardMetricText")[3].innerHTML.split(" ")[1]);`,
                `\t\tcardHoursMetric.innerHTML = editHoursAmount;`,
                `\t\tlet cardHoursBar = logCard.getElementsByClassName("cardMetricBarMiddle")[1];`,
                `\t\tlet percentHours = (editHoursAmount / cardAverageHoursMetric) * 100;`,
                `\t\tpercentHours = Math.round(percentHours * 100) / 100;`,
                `\t\tif (!cardAverageHoursMetric || cardAverageHoursMetric === 0) {`,
                `\t\t\tpercentHours = 100;`,
                `\t\t\tcardAverageHoursMetric = 0;`,
                `\t\t}`,
                `\t\tlet barPxHours = Math.round(percentHours);`,
                `\t\tlet barColorHours = "#00b4ee";`,
                `\t\tif (barPxHours >= 100) {`,
                `\t\t\tbarPxHours = 100;`,
                `\t\t\tbarColorHours = "#FD9808";`,
                `\t\t}`,
                `\t\tcardHoursAveragePercent.innerHTML = percentHours + "% of Average";`,
                `\t\tcardHoursBar.style.width = barPxHours + "px"`,
                `\t\tcardHoursBar.style.backgroundColor = barColorHours`,
                `\t\tcardDescription.innerHTML = description; `,
                `\t\tcardContent.style.maxHeight = cardContent.scrollHeight + "px";`,
                `\t\tconst dayUpdate = {`,
                `\t\t\t"day_number": dayNumber, `,
                `\t\t\t"title": title, `,
                `\t\t\t"description": description, `,
                `\t\t\t"links": links,`,
                `\t\t\t"hours": editHoursAmount`,
                `\t\t};`,
                `\t\tvscode.postMessage({ command: "editLog", value: dayUpdate }); `,
                `\t\tlet editLogsForm = document.getElementById("editLogCard"); `,
                `\t\teditLogsForm.style.visibility = 'hidden'; `,
                `\t}); `,
                //Share buttons
                `\tlet shareButtons = document.getElementsByClassName("cardHeaderShareButton"); `,
                `\tfor(let i = 0; i < shareButtons.length; i++) {`,
                `\t\tshareButtons[i].addEventListener("click", function () {`,
                `\t\t\tconst dayNumberValue = this.parentNode.parentNode.parentNode.firstChild.nextSibling.firstChild.nextSibling.innerHTML.split(" ")[1].slice(0, -1);`,
                `\t\t\tthis.firstChild.src = "https://100-days-of-code.s3-us-west-1.amazonaws.com/Milestones/alreadyShared.svg";`,
                `\t\t\tconsole.log(this.firstChild);`,
                `\t\t\tvscode.postMessage({ command: "incrementShare", value: dayNumberValue }); `,
                `\t\t}); `,
                `\t} `,
                `</script>`,
                `</html>`
            ].join("\n");
        }
        return htmlString;
    }
    return "Couldn't access logs file";
}

export function updateLogsHtml() {
    //updates logs.html

    const filepath = getLogsHtml();
    try {
        fs.writeFileSync(filepath, getUpdatedLogsHtmlString());
    } catch (err) {
        console.log(err);
    }
}
