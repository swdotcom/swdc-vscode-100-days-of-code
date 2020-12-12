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
exports.mergeStringArrays = exports.resetData = exports.rebuildData = exports.checkIfNameChanged = exports.displayLoginPromptIfNotLoggedIn = exports.isLoggedIn = exports.getSoftwareSessionAsJson = exports.getJwt = exports.setItem = exports.getItem = exports.displayReadmeIfNotExists = exports.getLocalREADMEFile = exports.compareDates = exports.getSoftwareSessionFile = exports.getSoftwareDir = exports.isMac = exports.isWindows = void 0;
const vscode_1 = require("vscode");
const LogsUtil_1 = require("./LogsUtil");
const SummaryDbUtil_1 = require("./SummaryDbUtil");
const CommandUtil_1 = require("./CommandUtil");
const MilestoneEventManager_1 = require("../managers/MilestoneEventManager");
const MilestonesUtil_1 = require("./MilestonesUtil");
const SummaryUtil_1 = require("./SummaryUtil");
const fileIt = require("file-it");
const fs = require("fs");
const os = require("os");
const { exec } = require("child_process");
let check_logon_interval;
let check_login_interval_max_times = 40;
let current_check_login_interval_count = 0;
let checking_login = false;
let _name = "";
function wrapExecPromise(cmd, projectDir) {
    return __awaiter(this, void 0, void 0, function* () {
        let result = null;
        try {
            let opts = projectDir !== undefined && projectDir !== null ? { cwd: projectDir } : {};
            result = yield execPromise(cmd, opts).catch(e => {
                if (e.message) {
                    console.log(e.message);
                }
                return null;
            });
        }
        catch (e) {
            if (e.message) {
                console.log(e.message);
            }
            result = null;
        }
        return result;
    });
}
function execPromise(command, opts) {
    return new Promise(function (resolve, reject) {
        exec(command, opts, (error, stdout, stderr) => {
            if (error) {
                reject(error);
                return;
            }
            resolve(stdout.trim());
        });
    });
}
function isWindows() {
    return process.platform.indexOf("win32") !== -1;
}
exports.isWindows = isWindows;
function isMac() {
    return process.platform.indexOf("darwin") !== -1;
}
exports.isMac = isMac;
function getSoftwareDir(autoCreate = true) {
    const homedir = os.homedir();
    let softwareDataDir = homedir;
    if (isWindows()) {
        softwareDataDir += "\\.software";
    }
    else {
        softwareDataDir += "/.software";
    }
    if (autoCreate && !fs.existsSync(softwareDataDir)) {
        fs.mkdirSync(softwareDataDir);
    }
    return softwareDataDir;
}
exports.getSoftwareDir = getSoftwareDir;
function getSoftwareSessionFile() {
    let file = getSoftwareDir();
    if (isWindows()) {
        file += "\\session.json";
    }
    else {
        file += "/session.json";
    }
    return file;
}
exports.getSoftwareSessionFile = getSoftwareSessionFile;
function compareDates(day1, day2) {
    return (day1.getDate() === day2.getDate() &&
        day1.getMonth() === day2.getMonth() &&
        day1.getFullYear() === day2.getFullYear());
}
exports.compareDates = compareDates;
function getLocalREADMEFile() {
    let file = __dirname;
    // the readme is one directory above the util
    if (isWindows()) {
        file += "\\..\\README.md";
    }
    else {
        file += "/../README.md";
    }
    return file;
}
exports.getLocalREADMEFile = getLocalREADMEFile;
function displayReadmeIfNotExists(override = false) {
    const displayedReadme = getItem("vscode_100doc_CtReadme");
    if (!displayedReadme) {
        const readmeUri = vscode_1.Uri.file(getLocalREADMEFile());
        vscode_1.commands.executeCommand("markdown.showPreview", readmeUri, vscode_1.ViewColumn.One, { locked: true });
        setItem("vscode_100doc_CtReadme", true);
    }
}
exports.displayReadmeIfNotExists = displayReadmeIfNotExists;
function getItem(key) {
    const jsonObj = getSoftwareSessionAsJson();
    let val = jsonObj[key] || null;
    return val;
}
exports.getItem = getItem;
function setItem(key, value) {
    fileIt.setJsonValue(getSoftwareSessionFile(), key, value);
}
exports.setItem = setItem;
function getJwt(prefix = false) {
    const jwt = getItem("jwt");
    if (!jwt || prefix) {
        return jwt;
    }
    else {
        return jwt.split("JWT ")[1];
    }
}
exports.getJwt = getJwt;
function getSoftwareSessionAsJson() {
    let data = null;
    const sessionFile = getSoftwareSessionFile();
    if (fs.existsSync(sessionFile)) {
        const content = fs.readFileSync(sessionFile).toString();
        if (content) {
            try {
                data = JSON.parse(content);
            }
            catch (e) {
                console.log(`unable to read session info: ${e.message}`);
                data = {};
            }
        }
    }
    return data ? data : {};
}
exports.getSoftwareSessionAsJson = getSoftwareSessionAsJson;
function isLoggedIn() {
    // getting authType to see if user is logged in. name is a check for if the user has not successfully logged in.
    if (getItem("authType") && getItem("name")) {
        _name = getItem("name");
        return true;
    }
    return false;
}
exports.isLoggedIn = isLoggedIn;
function displayLoginPromptIfNotLoggedIn() {
    if (!isLoggedIn()) {
        vscode_1.window
            .showInformationMessage("Please log in to use the 100 Days of Code plugin ", {
            modal: true
        }, "Log in")
            .then((selection) => __awaiter(this, void 0, void 0, function* () {
            if (selection === "Log in") {
                const items = [
                    { label: "Log in with Google" },
                    { label: "Log in with GitHub" },
                    { label: "Log in with Email" }
                ];
                const selection = yield vscode_1.window.showQuickPick(items);
                switch (selection === null || selection === void 0 ? void 0 : selection.label) {
                    case "Log in with Google":
                        vscode_1.commands.executeCommand("codetime.googleLogin");
                        break;
                    case "Log in with GitHub":
                        vscode_1.commands.executeCommand("codetime.githubLogin");
                        break;
                    default:
                        vscode_1.commands.executeCommand("codetime.codeTimeLogin");
                        break;
                }
                if (!checking_login) {
                    setTimeout(() => initializeLogInCheckInterval(), 8000);
                }
            }
        }));
    }
}
exports.displayLoginPromptIfNotLoggedIn = displayLoginPromptIfNotLoggedIn;
function initializeLogInCheckInterval() {
    checking_login = true;
    check_logon_interval = setInterval(() => __awaiter(this, void 0, void 0, function* () {
        const loggedIn = isLoggedIn();
        const passedTimeThreshold = current_check_login_interval_count >= check_login_interval_max_times;
        if (loggedIn) {
            checking_login = false;
            clearInterval(check_logon_interval);
            rebuildData();
        }
        else if (passedTimeThreshold) {
            checking_login = false;
            clearInterval(check_logon_interval);
        }
        current_check_login_interval_count++;
    }), 10000);
}
function checkIfNameChanged() {
    return __awaiter(this, void 0, void 0, function* () {
        const name = getItem("name");
        if (_name !== name) {
            _name = name;
            resetData();
            yield rebuildData();
            return true;
        }
        else {
            return false;
        }
    });
}
exports.checkIfNameChanged = checkIfNameChanged;
function rebuildData() {
    return __awaiter(this, void 0, void 0, function* () {
        vscode_1.window.showInformationMessage("Loading account logs and milestones...");
        yield LogsUtil_1.syncLogs();
        yield MilestoneEventManager_1.MilestoneEventManager.getInstance().fetchMilestones();
        // update the summary on init
        yield SummaryDbUtil_1.fetchSummary();
        CommandUtil_1.reloadCurrentView();
    });
}
exports.rebuildData = rebuildData;
function resetData() {
    return __awaiter(this, void 0, void 0, function* () {
        // reset files
        MilestonesUtil_1.deleteMilestoneJson();
        LogsUtil_1.deleteLogsJson();
        SummaryUtil_1.deleteSummaryJson();
    });
}
exports.resetData = resetData;
function mergeStringArrays(array1, array2) {
    array1 = array1 || [];
    array2 = array2 || [];
    return [...new Set([...array1, ...array2])];
}
exports.mergeStringArrays = mergeStringArrays;
//# sourceMappingURL=Util.js.map