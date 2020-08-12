import { getSoftwareDir, isWindows, getItem, getFileDataAsJson } from "./Util";
import { serverIsAvailable, softwareGet, isResponseOk, softwarePost, softwarePut } from "../managers/HttpManager";
import { Log } from "../models/Log";
import { compareWithLocalLogs, getMostRecentLogObject, checkLogsJson, getLogsJson } from "./LogsUtil";
import fs = require("fs");

export let updatedLogsDb = true;
export let sentLogsDb = true;

let toCreateLogs: Array<any> = [];
let toUpdateLogs: Array<any> = [];

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
    } catch (err) {
        console.log(err);
    }
}

export function checkLogsPayload() {
    const filepath = getLogsPayloadJson();
    const payloadData = getFileDataAsJson(filepath);
    try {
        updatedLogsDb = payloadData["updatedLogsDb"];
        sentLogsDb = payloadData["sentLogsDb"];
        toCreateLogs = payloadData["toCreateLogs"];
        toUpdateLogs = payloadData["toUpdateLogs"];
    } catch (err) {
        console.log(err);
    }
}

export function deleteLogsPayloadJson() {
    const filepath = getLogsPayloadJson();
    const fileExists = fs.existsSync(filepath);
    if (fileExists) {
        fs.unlinkSync(filepath);
    }
}

export async function fetchLogs() {
    const jwt = getItem("jwt");
    if (jwt) {
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
                        log.date = element.unix_date * 1000; // seconds --> milliseconds
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
            unix_date: Math.round(log.date / 1000), // milliseconds --> seconds
            local_date: Math.round(log.date / 1000) - offset_minutes * 60, // milliseconds --> seconds
            offset_minutes,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
        };
        toCreateLogs.push(sendLog);
    }
    const jwt = getItem("jwt");
    if (jwt) {
        let available = false;
        try {
            available = await serverIsAvailable();
        } catch (err) {
            available = false;
        }
        if (available) {
            const resp = await softwarePost("/100doc/logs", toCreateLogs, jwt);
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
            let rawLogs = getFileDataAsJson(filepath, {});
            let logs = rawLogs.logs || [];
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
                unix_date: Math.round(log.date / 1000), // milliseconds --> seconds
                local_date: Math.round(log.date / 1000) - offset_minutes * 60, // milliseconds --> seconds
                offset_minutes,
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
            };
            toUpdateLogs.push(sendLog);
        } else {
            updatedLogsDb = false;
        }
    }
    const jwt = getItem("jwt");
    if (jwt) {
        let available = false;
        try {
            available = await serverIsAvailable();
        } catch (err) {
            available = false;
        }
        if (available) {
            const added: boolean = isResponseOk(await softwarePut("/100doc/logs", toUpdateLogs, jwt));
            if (!added) {
                updatedLogsDb = false;
            } else {
                updatedLogsDb = true;
                toUpdateLogs = [];
            }
        } else {
            updatedLogsDb = false;
        }
    } else {
        updatedLogsDb = false;
    }
}

export function toCreateLogsPush(log: Log) {
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
        unix_date: Math.round(log.date / 1000), // milliseconds --> seconds
        local_date: Math.round(log.date / 1000) - offset_minutes * 60, // milliseconds --> seconds
        offset_minutes,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
    };
    toCreateLogs.push(sendLog);
    sentLogsDb = false;
}

export function toUpdateLogsPush(log: Log) {
    for (let i = 0; i < toUpdateLogs.length; i++) {
        if (toUpdateLogs[i].day_number === log.day_number) {
            const date = new Date(log.date);
            const offset_minutes = date.getTimezoneOffset();
            toUpdateLogs[i] = {
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
            updatedLogsDb = false;
            return;
        }
    }
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
        unix_date: Math.round(log.date / 1000), // milliseconds --> seconds
        local_date: Math.round(log.date / 1000) - offset_minutes * 60, // milliseconds --> seconds
        offset_minutes,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
    };
    toUpdateLogs.push(sendLog);
    updatedLogsDb = false;
}

export function clearToCreateLogs() {
    toCreateLogs = [];
}

export function clearToUpdateLogs() {
    toUpdateLogs = [];
}
