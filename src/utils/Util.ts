import { commands, ViewColumn, Uri, window } from "vscode";
import { _100_DAYS_OF_CODE_PLUGIN_ID, _100_DAYS_OF_CODE_EXT_ID } from "./Constants";
import { deleteLogsJson, syncLogs } from "./LogsUtil";
import { reloadCurrentView } from "./CommandUtil";
import { MilestoneEventManager } from "../managers/MilestoneEventManager";
import { deleteMilestoneJson } from "./MilestonesUtil";
import { deleteSummaryJson } from "./SummaryUtil";

const moment = require("moment-timezone");
const fileIt = require("file-it");
const fs = require("fs");
const os = require("os");

let check_logon_interval: NodeJS.Timeout;
let check_login_interval_max_times = 40;
let current_check_login_interval_count = 0;
let checking_login = false;
let _name = "";


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
    const displayedReadme = getItem("vscode_100doc_CtReadme");
    if (!displayedReadme || override) {
        const readmeUri = Uri.file(getLocalREADMEFile());
        commands.executeCommand("markdown.showPreview", readmeUri, ViewColumn.One, { locked: true });
        setItem("vscode_100doc_CtReadme", true);

        commands.executeCommand("DoC.revealTree");
    }
}

export function getItem(key: string) {
    const jsonObj = getSoftwareSessionAsJson();
    let val = jsonObj[key] || null;
    return val;
}

export function setItem(key: string, value: any) {
    fileIt.setJsonValue(getSoftwareSessionFile(), key, value);
}

export function getJwt(prefix = false) {
    const jwt = getItem("jwt");
    if (!jwt || prefix) {
        return jwt;
    } else {
        return jwt.split("JWT ")[1];
    }
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
    if (getItem("name")) {
        _name = getItem("name");
        return true;
    }
    return false;
}

export function displayLoginPromptIfNotLoggedIn() {
    const lastPromptDate = getItem("last100doc_loginPromptDate");
    const today = moment().format("YYYY-MM-DD");
    if (!isLoggedIn() && lastPromptDate !== today) {
        setItem("last100doc_loginPromptDate", today);
        window
            .showInformationMessage(
                "You must log in with Code Time to start tracking your 100 Days of Code.",
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
                        default:
                            commands.executeCommand("codetime.codeTimeLogin");
                            break;
                    }

                    if (!checking_login) {
                        setTimeout(() => initializeLogInCheckInterval(), 8000);
                    }
                }
            });
    }
}

function initializeLogInCheckInterval() {
    checking_login = true;
    check_logon_interval = setInterval(async () => {
        const loggedIn = isLoggedIn();
        const passedTimeThreshold = current_check_login_interval_count >= check_login_interval_max_times;

        if (loggedIn) {
            checking_login = false;
            clearInterval(check_logon_interval);
            rebuildData()
        } else if (passedTimeThreshold) {
            checking_login = false;
            clearInterval(check_logon_interval);
        }
        current_check_login_interval_count++;
    }, 10000);
}

export async function checkIfNameChanged() {
    const name = getItem("name");
    if (_name !== name) {
        _name = name;

        await rebuildData();

        return true;
    } else {
        return false;
    }
}

export async function rebuildData() {

    resetData();

    window.showInformationMessage("Loading account logs and milestones...");

    await Promise.all([
        syncLogs(),
        MilestoneEventManager.getInstance().fetchMilestones(),
    ]);

    reloadCurrentView();
}

export async function resetData() {
    // reset files
    deleteMilestoneJson();
    deleteLogsJson();
    deleteSummaryJson();
}

export function mergeStringArrays(array1: string[], array2: string[]) {
    array1 = array1 || [];
    array2 = array2 || [];
    return [...new Set([...array1, ...array2])];
}

export function formatNumber(num) {
    let str = "";
    num = num ? parseFloat(num) : 0;
    if (num >= 1000) {
        str = num.toLocaleString();
    } else if (num % 1 === 0) {
        str = num.toFixed(0);
    } else {
        str = num.toFixed(2);
    }
    return str;
}

export function getMillisSinceLastUpdate(file) {
    if (!fs.existsSync(file)) {
        return -1;
    }
    const stats = fs.statSync(file);

    return (new Date().getTime() - stats.mtime);
}

export function getInputFormStyles() {
    let cardTextColor = "#FFFFFF";
    let cardBackgroundColor = "rgba(255,255,255,0.05)";
    let cardGrayedLevel = "#474747";
    let sharePath = "https://100-days-of-code.s3-us-west-1.amazonaws.com/Milestones/share.svg";
    if (window.activeColorTheme.kind === 1) {
        cardTextColor = "#444444";
        cardBackgroundColor = "rgba(0,0,0,0.10)";
        cardGrayedLevel = "#B5B5B5";
        sharePath = "https://100-days-of-code.s3-us-west-1.amazonaws.com/Milestones/shareLight.svg";
    }
    return { cardTextColor, cardBackgroundColor, cardGrayedLevel, sharePath };
}
