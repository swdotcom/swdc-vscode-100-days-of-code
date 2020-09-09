import { getItem } from "./Util";
import { softwareGet, isResponseOk } from "../managers/HttpManager";
import { Log } from "../models/Log";
import fs = require("fs");
import { getFile, getFileDataAsJson } from "../managers/FileManager";

export let updatedLogsDb = true;
export let sentLogsDb = true;

let toCreateLogs: Array<any> = [];
let toUpdateLogs: Array<any> = [];

function getLogsPayloadFilePath(): string {
    return getFile("logsPayload.json");
}

export function createLogsPayloadJson() {
    const filepath = getLogsPayloadFilePath();
    const fileData = {
        updatedLogsDb,
        sentLogsDb,
        toCreateLogs,
        toUpdateLogs
    };
    try {
        fs.writeFileSync(filepath, JSON.stringify(fileData, null, 2));
    } catch (err) {
        console.log(err);
    }
}

export function checkLogsPayload() {
    // default these to keep the loop running
    updatedLogsDb = false;
    sentLogsDb = false;
    toCreateLogs = [];
    toUpdateLogs = [];

    const filepath = getLogsPayloadFilePath();
    const payloadData = getFileDataAsJson(filepath);

    if (!payloadData) {
        // no logsPayload.json file
        return;
    }
    if (Object.keys(payloadData).length < 4) {
        console.log("Logs payload object is empty");
        return;
    }

    // only update if there is payloadData
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
    const filepath = getLogsPayloadFilePath();
    const fileExists = fs.existsSync(filepath);
    if (fileExists) {
        fs.unlinkSync(filepath);
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
