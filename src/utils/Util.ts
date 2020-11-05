import { commands, ViewColumn, Uri, window, extensions } from "vscode";
import { _100_DAYS_OF_CODE_PLUGIN_ID, _100_DAYS_OF_CODE_EXT_ID } from "./Constants";
import { syncLogs } from "./LogSync";
import {
    checkMilestonesPayload,
    pushUpdatedMilestones,
    fetchMilestones,
    sentMilestonesDb,
    updatedMilestonesDb,
    pushNewMilestones
} from "./MilestonesDbUtil";
import { fetchSummary } from "./SummaryDbUtil";
import { reloadCurrentView } from "./CommandUtil";

const fileIt = require("file-it");
const fs = require("fs");
const os = require("os");
const { exec } = require("child_process");

let check_logon_interval: NodeJS.Timeout;
let check_login_interval_max_times = 40;
let current_check_login_interval_count = 0;
let checking_login = false;
let _name = "";

export function getPluginId() {
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
    if (!displayedReadme) {
        const readmeUri = Uri.file(getLocalREADMEFile());
        commands.executeCommand("markdown.showPreview", readmeUri, ViewColumn.One, { locked: true });
        setItem("vscode_100doc_CtReadme", true);
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
            window.showInformationMessage("Loading account logs and milestones...");

            setName();

            await syncLogs();

            // milestones
            checkMilestonesPayload();
            if (!sentMilestonesDb) {
                pushNewMilestones();
            }
            if (!updatedMilestonesDb) {
                pushUpdatedMilestones();
            }

            await fetchMilestones();

            // update the summary on init
            fetchSummary();

            clearInterval(check_logon_interval);

            checking_login = false;

            reloadCurrentView();
        } else if (passedTimeThreshold) {
            clearInterval(check_logon_interval);

            checking_login = false;
        }
        current_check_login_interval_count++;
    }, 9000);
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
