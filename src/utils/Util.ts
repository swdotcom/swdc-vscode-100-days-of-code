import { commands, ViewColumn, Uri, window, QuickPick, QuickPickItem } from "vscode";
import { getLatestLogEntryNumber } from "./LogsUtil";
// import { api_endpoint } from "./Constants";

const fs = require("fs");
const os = require("os");
const open = require("open");
const { exec } = require("child_process");

export function getExtensionName() {
    return "100doc";
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

        commands.executeCommand("markdown.showPreview", readmeUri, ViewColumn.One);
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
                "Please login with one of the following options to use the plugin ",
                {
                    modal: true
                },
                "Login"
            )
            .then(async selection => {
                if (selection === "Login") {
                    const items = [
                        { label: "Login with Google" },
                        { label: "Login with GitHub" },
                        { label: "Login with Email" }
                    ];

                    const selection = await window.showQuickPick(items);
                    switch (selection?.label) {
                        case "Login with Google":
                            commands.executeCommand("codetime.googleLogin");
                            break;
                        case "Login with GitHub":
                            commands.executeCommand("codetime.githubLogin");
                            break;
                        case "Login with Email":
                            commands.executeCommand("codetime.codeTimeLogin");
                            break;
                        default:
                            break;
                    }
                }
            });
    }
}
