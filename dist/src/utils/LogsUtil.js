"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.syncLogs = exports.deleteLogDay = exports.createLog = exports.updateLog = exports.resetPreviousLogIfEmpty = exports.editLogEntry = exports.updateLogShare = exports.checkIfOnStreak = exports.getLastSevenLoggedDays = exports.getAllCodetimeHours = exports.getLogDateRange = exports.getMostRecentLogObject = exports.getLatestLogEntryNumber = exports.addLogToJson = exports.addDailyLog = exports.setDailyMilestonesByDayNumber = exports.getDayNumberFromDate = exports.getLogsSummary = exports.writeToLogsJson = exports.getAllLogObjects = exports.deleteLogsJson = exports.checkLogsJson = exports.getLogsFilePath = void 0;
const Util_1 = require("./Util");
const fs = require("fs");
const CodetimeMetrics_1 = require("../models/CodetimeMetrics");
const Log_1 = require("../models/Log");
const SummaryUtil_1 = require("./SummaryUtil");
const FileManager_1 = require("../managers/FileManager");
const HttpManager_1 = require("../managers/HttpManager");
const vscode_1 = require("vscode");
const MilestonesUtil_1 = require("./MilestonesUtil");
const Constants_1 = require("./Constants");
const moment = require("moment-timezone");
let currently_deleting_log_date = -1;
function getLogsFilePath() {
    return FileManager_1.getFile("logs.json");
}
exports.getLogsFilePath = getLogsFilePath;
function checkLogsJson() {
    const filepath = getLogsFilePath();
    if (!fs.existsSync(filepath)) {
        // create empty logs
        const logs = [];
        try {
            fs.writeFileSync(filepath, JSON.stringify(logs, null, 2));
        }
        catch (e) {
            return false;
        }
    }
    return true;
}
exports.checkLogsJson = checkLogsJson;
function deleteLogsJson() {
    const filepath = getLogsFilePath();
    const fileExists = fs.existsSync(filepath);
    if (fileExists) {
        fs.unlinkSync(filepath);
    }
}
exports.deleteLogsJson = deleteLogsJson;
function getAllLogObjects() {
    const exists = checkLogsJson();
    if (exists) {
        const filepath = getLogsFilePath();
        const logs = FileManager_1.getFileDataAsJson(filepath);
        return logs || [];
    }
    return [];
}
exports.getAllLogObjects = getAllLogObjects;
function writeToLogsJson(logs = []) {
    const filepath = getLogsFilePath();
    try {
        fs.writeFileSync(filepath, JSON.stringify(logs, null, 2));
    }
    catch (err) {
        console.log(err);
    }
}
exports.writeToLogsJson = writeToLogsJson;
function getLogsSummary() {
    const logs = getAllLogObjects();
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
            if (Util_1.compareDates(new Date(previousDate + hours24), new Date(logs[i].date))) {
                current_streak++;
                if (current_streak > longest_streak) {
                    longest_streak = current_streak;
                }
            }
            else {
                current_streak = 0;
            }
            previousDate = logs[i].date;
        }
        const lastLog = logs[logs.length - 1];
        // checks if last log is today
        if (Util_1.compareDates(new Date(lastLog.date), new Date())) {
            currentHours = lastLog.codetime_metrics.hours;
            currentKeystrokes = lastLog.codetime_metrics.keystrokes;
            currentLines = lastLog.codetime_metrics.lines_added;
            totalDays++;
        }
        else {
            totalHours += lastLog.codetime_metrics.hours;
            totalLinesAdded += lastLog.codetime_metrics.lines_added;
            totalKeystrokes += lastLog.codetime_metrics.keystrokes;
            totalDays++;
        }
        if (Util_1.compareDates(new Date(previousDate + hours24), new Date(lastLog.date))) {
            current_streak++;
            if (current_streak > longest_streak) {
                longest_streak = current_streak;
            }
        }
        else {
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
exports.getLogsSummary = getLogsSummary;
function getDayNumberFromDate(dateUnix) {
    const logs = getAllLogObjects();
    let date = new Date(dateUnix);
    for (let log of logs) {
        if (Util_1.compareDates(new Date(log.date), date)) {
            return log.day_number;
        }
    }
    return -1;
}
exports.getDayNumberFromDate = getDayNumberFromDate;
/**
 * compares a log to the logs stored locally to check if it already exists
 * checks against both date and day number
 * @param log - a log object
 */
function checkIfLogExists(log) {
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
function setDailyMilestonesByDayNumber(dayNumber, newMilestones) {
    let logs = getAllLogObjects();
    let log = logs[dayNumber - 1];
    newMilestones = newMilestones.concat(log.milestones);
    newMilestones = Array.from(new Set(newMilestones));
    log.milestones = newMilestones;
    writeToLogsJson(logs);
}
exports.setDailyMilestonesByDayNumber = setDailyMilestonesByDayNumber;
function addDailyLog() {
    return __awaiter(this, void 0, void 0, function* () {
        return yield addLogToJson(Constants_1.NO_TITLE_LABEL, "", // description
        "0", // hours
        "0", // keystrokes
        "0", // lines
        []);
    });
}
exports.addDailyLog = addDailyLog;
function addLogToJson(title, description, hours, keystrokes, lines, links) {
    return __awaiter(this, void 0, void 0, function* () {
        const dayNum = getLatestLogEntryNumber() + 1;
        if (dayNum === 0) {
            console.log("Logs json could not be read");
            return false;
        }
        let codetimeMetrics = new CodetimeMetrics_1.CodetimeMetrics();
        codetimeMetrics.hours = parseFloat(hours);
        codetimeMetrics.lines_added = parseInt(lines);
        codetimeMetrics.keystrokes = parseInt(keystrokes);
        let log = new Log_1.Log();
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
        }
        else {
            yield createLog(log);
        }
        SummaryUtil_1.updateSummaryJson();
    });
}
exports.addLogToJson = addLogToJson;
function getLatestLogEntryNumber() {
    const logs = getAllLogObjects();
    return logs ? logs.length : 0;
}
exports.getLatestLogEntryNumber = getLatestLogEntryNumber;
function getMostRecentLogObject() {
    const logs = getAllLogObjects();
    if (logs.length > 0) {
        return logs[logs.length - 1];
    }
    else {
        return new Log_1.Log();
    }
}
exports.getMostRecentLogObject = getMostRecentLogObject;
function getLogDateRange() {
    const logs = getAllLogObjects();
    let dates = [];
    if (logs.length) {
        dates.push(logs[0].date);
        dates.push(logs[logs.length - 1].date);
    }
    return dates;
}
exports.getLogDateRange = getLogDateRange;
function getAllCodetimeHours() {
    const logs = getAllLogObjects();
    let sendHours = [];
    for (let i = 0; i < logs.length; i++) {
        if (logs[i].day_number) {
            sendHours.push(logs[i].codetime_metrics.hours);
        }
    }
    return sendHours;
}
exports.getAllCodetimeHours = getAllCodetimeHours;
function getLastSevenLoggedDays() {
    const logs = getAllLogObjects();
    let sendLogs = [];
    if (logs.length === 0) {
        return sendLogs;
    }
    if (logs[logs.length - 1].title !== Constants_1.NO_TITLE_LABEL) {
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
exports.getLastSevenLoggedDays = getLastSevenLoggedDays;
function checkIfOnStreak() {
    const logs = getAllLogObjects();
    // one day streak
    if (logs.length < 2) {
        return true;
    }
    const currDate = new Date(logs[logs.length - 1].date);
    const prevDatePlusDay = new Date(logs[logs.length - 2].date + 86400000);
    return Util_1.compareDates(currDate, prevDatePlusDay);
}
exports.checkIfOnStreak = checkIfOnStreak;
function updateLogShare(day) {
    let logs = getAllLogObjects();
    if (!logs[day - 1].shared) {
        logs[day - 1].shared = true;
        SummaryUtil_1.incrementSummaryShare();
        writeToLogsJson(logs);
    }
}
exports.updateLogShare = updateLogShare;
function editLogEntry(dayNumber, title, description, links, editedHours) {
    return __awaiter(this, void 0, void 0, function* () {
        let logs = getAllLogObjects();
        let log = logs[dayNumber - 1];
        log.title = title;
        log.description = description;
        log.links = links;
        const currentLoggedHours = log.codetime_metrics.hours;
        if (editedHours >= 0 && editedHours <= 12) {
            log.codetime_metrics.hours = editedHours;
        }
        else if (editedHours < 0) {
            log.codetime_metrics.hours = 0;
        }
        else {
            log.codetime_metrics.hours = 12;
        }
        let summaryTotalHours = SummaryUtil_1.getSummaryTotalHours();
        if (dayNumber === logs.length) {
            SummaryUtil_1.setSummaryCurrentHours(log.codetime_metrics.hours);
        }
        else {
            summaryTotalHours -= currentLoggedHours;
            summaryTotalHours += log.codetime_metrics.hours;
            SummaryUtil_1.setSummaryTotalHours(summaryTotalHours);
        }
        yield updateLog(log);
    });
}
exports.editLogEntry = editLogEntry;
function isLogEmpty(log) {
    return (log.codetime_metrics.hours === 0 &&
        log.codetime_metrics.keystrokes === 0 &&
        log.codetime_metrics.lines_added === 0 &&
        log.title === Constants_1.NO_TITLE_LABEL &&
        (log.description === "No Description" || !log.description) &&
        log.milestones.length === 0 &&
        (log.links.length === 0 || (log.links.length === 1 && log.links[0] === "")));
}
/**
 * If the last log is empty (NO_TITLE_LABEL, keystrokes, etc) then set the log date
 */
function resetPreviousLogIfEmpty() {
    return __awaiter(this, void 0, void 0, function* () {
        const logDate = new Date();
        let logs = getAllLogObjects();
        if (logs.length > 0) {
            // get the last log
            const log = logs[logs.length - 1];
            if (log && isLogEmpty(log)) {
                log.date = logDate.valueOf();
                logs[logs.length - 1] = log;
                // update the rest of the info like end of day and persist to the backend
                updateLog(log);
            }
        }
    });
}
exports.resetPreviousLogIfEmpty = resetPreviousLogIfEmpty;
// updates a log locally and on the server
function updateLog(log) {
    return __awaiter(this, void 0, void 0, function* () {
        // get all log objects
        const logs = yield getLocalLogsFromFile();
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
        const preparedLog = yield prepareLogForServerUpdate(log);
        yield updateExistingLogOnServer(preparedLog);
    });
}
exports.updateLog = updateLog;
// creates a new log locally and on the server
function createLog(log) {
    return __awaiter(this, void 0, void 0, function* () {
        // get all log objects
        const logs = yield getLocalLogsFromFile();
        // add the new log
        const updatedLogs = [...logs, log];
        // write back to the local file
        saveLogsToFile(updatedLogs);
        // push the new log to the server
        const preparedLog = yield prepareLogForServerUpdate(log);
        yield pushNewLogToServer(preparedLog);
    });
}
exports.createLog = createLog;
function deleteLogDay(unix_date) {
    return __awaiter(this, void 0, void 0, function* () {
        if (currently_deleting_log_date !== -1) {
            vscode_1.window.showInformationMessage("Currently waiting to delete the requested log, please wait.");
            return;
        }
        const jwt = Util_1.getItem("jwt");
        if (jwt) {
            currently_deleting_log_date = unix_date;
            const resp = yield HttpManager_1.softwareDelete("/100doc/logs", { unix_dates: [unix_date] }, jwt);
            if (HttpManager_1.isResponseOk(resp)) {
                vscode_1.window.showInformationMessage("Your log has been successfully deleted.");
                // delete the log
                let logs = yield getLocalLogsFromFile();
                // delete the log based on the dayNum
                logs = logs.filter((n) => n.date !== unix_date);
                saveLogsToFile(logs);
                yield syncLogs();
                vscode_1.commands.executeCommand("DoC.viewLogs");
            }
            currently_deleting_log_date = -1;
        }
    });
}
exports.deleteLogDay = deleteLogDay;
// pulls logs from the server and saves them locally. This will be run periodically.
// logs have a format like [ { day_number: 1, date: ... }, ... ]
function syncLogs() {
    return __awaiter(this, void 0, void 0, function* () {
        const jwt = Util_1.getItem("jwt");
        let serverLogs = getLocalLogsFromFile();
        if (jwt) {
            const resp = yield HttpManager_1.softwareGet("/100doc/logs", jwt);
            if (HttpManager_1.isResponseOk(resp)) {
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
            yield addMilestonesToLogs(formattedLogs);
            saveLogsToFile(formattedLogs);
        }
        if (createLogForToday) {
            // create a log for today and add it to the local logs
            yield addDailyLog();
        }
    });
}
exports.syncLogs = syncLogs;
// converts local log to format that server will accept
function prepareLogForServerUpdate(log) {
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
        unix_date: Math.round(log.date / 1000),
        local_date: Math.round(log.date / 1000) - offset_minutes * 60,
        offset_minutes,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
    };
    return preparedLog;
}
function saveLogsToFile(logs = []) {
    const filePath = getLogFilePath();
    try {
        fs.writeFileSync(filePath, JSON.stringify(logs, null, 2));
    }
    catch (err) {
        console.log(err);
    }
}
function getLocalLogsFromFile() {
    const filePath = getLogFilePath();
    let logs = [];
    const exists = checkIfLocalFileExists(filePath);
    if (exists) {
        logs = FileManager_1.getFileDataAsJson(filePath);
    }
    return logs;
}
function getLogFilePath() {
    return FileManager_1.getFile("logs.json");
}
function checkIfLocalFileExists(filepath) {
    if (fs.existsSync(filepath)) {
        return true;
    }
    else {
        return false;
    }
}
// push new local logs to the server
function pushNewLogToServer(log) {
    return __awaiter(this, void 0, void 0, function* () {
        const jwt = Util_1.getItem("jwt");
        if (jwt) {
            yield HttpManager_1.softwarePost("/100doc/logs", [log], jwt);
        }
    });
}
// push new local logs to the server
function updateExistingLogOnServer(log) {
    return __awaiter(this, void 0, void 0, function* () {
        const jwt = Util_1.getItem("jwt");
        if (jwt) {
            yield HttpManager_1.softwarePut("/100doc/logs", [log], jwt);
        }
    });
}
// formats logs from the server into the local log model format before saving locally
// logs have a format like [ { day_number: 1, date: ... }, ... ]
function formatLogs(logs) {
    let formattedLogs = [];
    logs.forEach((log) => {
        let formattedLog = new Log_1.Log();
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
    formattedLogs.sort((a, b) => {
        return a.day_number - b.day_number;
    });
    return formattedLogs;
}
// joins milestones to each log
function addMilestonesToLogs(logs) {
    return __awaiter(this, void 0, void 0, function* () {
        // fetch all the milestones at once and then add them to each log iteratively below
        const milestoneData = MilestonesUtil_1.getAllMilestones();
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
    });
}
//# sourceMappingURL=LogsUtil.js.map