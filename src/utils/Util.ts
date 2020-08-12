import { commands, ViewColumn, Uri, window, extensions } from "vscode";
import { getLatestLogEntryNumber } from "./LogsUtil";
import { _100_DAYS_OF_CODE_PLUGIN_ID, _100_DAYS_OF_CODE_EXT_ID } from "./Constants";
import { softwarePost, isResponseOk } from "../managers/HttpManager";

const fs = require("fs");
const os = require("os");
const crypto = require("crypto");
const { exec } = require("child_process");

const alpha = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

let workspace_name: any = null;
let _name = "";

function getPluginId() {
    return _100_DAYS_OF_CODE_PLUGIN_ID;
}

export function getPluginName() {
    return _100_DAYS_OF_CODE_EXT_ID;
}

export function getVersion() {
    const extension = extensions.getExtension(_100_DAYS_OF_CODE_EXT_ID);
    if (extension) {
        return extension.packageJSON.version;
    } else {
        return;
    }
}

function getOs() {
    let parts = [];
    let osType = os.type();
    if (osType) {
        parts.push(osType);
    }
    let osRelease = os.release();
    if (osRelease) {
        parts.push(osRelease);
    }
    let platform = os.platform();
    if (platform) {
        parts.push(platform);
    }
    if (parts.length > 0) {
        return parts.join("_");
    }
    return "";
}

function nowInSecs() {
    return Math.round(Date.now() / 1000);
}

async function getCommandResultLine(cmd: string, projectDir = null) {
    const resultList = await getCommandResultList(cmd, projectDir);

    let resultLine = "";
    if (resultList && resultList.length) {
        for (let i = 0; i < resultList.length; i++) {
            let line = resultList[i];
            if (line && line.trim().length > 0) {
                resultLine = line.trim();
                break;
            }
        }
    }
    return resultLine;
}

async function getCommandResultList(cmd: any, projectDir = null) {
    let result: any = await wrapExecPromise(`${cmd}`, projectDir);
    if (!result) {
        return [];
    }
    const contentList = result.replace(/\r\n/g, "\r").replace(/\n/g, "\r").split(/\r/);
    return contentList;
}

async function wrapExecPromise(cmd: string, projectDir: null | undefined) {
    let result = null;
    try {
        let opts = projectDir !== undefined && projectDir !== null ? { cwd: projectDir } : {};
        result = await execPromise(cmd, opts).catch(e => {
            if (e.message) {
                console.log(e.message);
            }
            return null;
        });
    } catch (e) {
        if (e.message) {
            console.log(e.message);
        }
        result = null;
    }
    return result;
}

function execPromise(command: any, opts: { cwd: any } | { cwd?: undefined }) {
    return new Promise(function (resolve, reject) {
        exec(command, opts, (error: any, stdout: string, stderr: any) => {
            if (error) {
                reject(error);
                return;
            }

            resolve(stdout.trim());
        });
    });
}

async function getHostname() {
    let hostname = await getCommandResultLine("hostname");
    return hostname;
}

function getSessionFileCreateTime() {
    let sessionFile = getSoftwareSessionFile();
    const stat = fs.statSync(sessionFile);
    if (stat.birthtime) {
        return stat.birthtime;
    }
    return stat.ctime;
}

function getWorkspaceName() {
    if (!workspace_name) {
        workspace_name = randomCode();
    }
    return workspace_name;
}

function randomCode() {
    return crypto
        .randomBytes(16)
        .map((value: number) => alpha.charCodeAt(Math.floor((value * alpha.length) / 256)))
        .toString();
}

export async function sendHeartbeat(reason: string) {
    let jwt = getItem("jwt");
    if (jwt) {
        let heartbeat = {
            pluginId: getPluginId(),
            os: getOs(),
            start: nowInSecs(),
            version: getVersion(),
            hostname: await getHostname(),
            session_ctime: getSessionFileCreateTime(),
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            trigger_annotation: reason,
            editor_token: getWorkspaceName()
        };
        let api = `/data/heartbeat`;
        softwarePost(api, heartbeat, jwt).then(async resp => {
            if (!isResponseOk(resp)) {
                console.log("unable to send heartbeat ping");
            }
        });
    }
}

export function isWindows() {
    return process.platform.indexOf("win32") !== -1;
}

export function isMac() {
    return process.platform.indexOf("darwin") !== -1;
}

export function getSoftwareDir(autoCreate = true) {
    const homedir = os.homedir();
    let softwareDataDir = homedir;
    if (isWindows()) {
        softwareDataDir += "\\.software";
    } else {
        softwareDataDir += "/.software";
    }

    if (autoCreate && !fs.existsSync(softwareDataDir)) {
        fs.mkdirSync(softwareDataDir);
    }

    return softwareDataDir;
}

export function getSoftwareSessionFile() {
    let file = getSoftwareDir();
    if (isWindows()) {
        file += "\\session.json";
    } else {
        file += "/session.json";
    }
    return file;
}

export function compareDates(day1: Date, day2: Date) {
    return (
        day1.getDate() === day2.getDate() &&
        day1.getMonth() === day2.getMonth() &&
        day1.getFullYear() === day2.getFullYear()
    );
}

export function getLocalREADMEFile() {
    let file = __dirname;
    // the readme is one directory above the util
    if (isWindows()) {
        file += "\\..\\README.md";
    } else {
        file += "/../README.md";
    }
    return file;
}

export function displayReadmeIfNotExists(override = false) {
    const logsEmpty = getLatestLogEntryNumber() <= 0;
    if (logsEmpty || override) {
        const readmeUri = Uri.file(getLocalREADMEFile());

        commands.executeCommand("markdown.showPreview", readmeUri, ViewColumn.One, { locked: true });
    }
}

export function getItem(key: string) {
    const jsonObj = getSoftwareSessionAsJson();
    let val = jsonObj[key] || null;
    return val;
}

export function getSoftwareSessionAsJson() {
    let data = null;

    const sessionFile = getSoftwareSessionFile();
    if (fs.existsSync(sessionFile)) {
        const content = fs.readFileSync(sessionFile).toString();
        if (content) {
            try {
                data = JSON.parse(content);
            } catch (e) {
                console.log(`unable to read session info: ${e.message}`);
                data = {};
            }
        }
    }
    return data ? data : {};
}

export function isLoggedIn(): boolean {
    // getting authType to see if user is logged in. name is a check for if the user has not successfully logged in.
    if (getItem("authType") && getItem("name")) {
        return true;
    }
    return false;
}

export function displayLoginPromptIfNotLoggedIn() {
    if (!isLoggedIn()) {
        window
            .showInformationMessage(
                "Please log in to use the 100 Days of Code plugin ",
                {
                    modal: true
                },
                "Log in"
            )
            .then(async selection => {
                if (selection === "Log in") {
                    const items = [
                        { label: "Log in with Google" },
                        { label: "Log in with GitHub" },
                        { label: "Log in with Email" }
                    ];
                    const selection = await window.showQuickPick(items);
                    switch (selection?.label) {
                        case "Log in with Google":
                            commands.executeCommand("codetime.googleLogin");
                            break;
                        case "Log in with GitHub":
                            commands.executeCommand("codetime.githubLogin");
                            break;
                        case "Log in with Email":
                            commands.executeCommand("codetime.codeTimeLogin");
                            break;
                        default:
                            break;
                    }
                }
            });
    }
}

export function setName() {
    const name = getItem("name");
    if (name && name !== "") {
        _name = name;
    }
}

export function checkIfNameChanged() {
    const name = getItem("name");
    if (_name !== name) {
        return true;
    } else {
        return false;
    }
}

/**
 * reads data from local file into a JSON object
 *
 * @param file - the absolute file path
 * @param defaultType - a JSON default type to return
 */
export function getFileDataAsJson(file: string, defaultResult: any = {}) {
    let data = defaultResult;
    if (!fs.existsSync(file)) {
        console.log("File not found: " + file);
        return data;
    }
    try {
        let buffer = fs.readFileSync(file, "utf-8");
        data = JSON.parse(buffer);
    } catch (err) {
        console.log("Could not read file:" + err.message);
    }
    return data;
}
