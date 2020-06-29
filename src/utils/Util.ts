import { commands, ViewColumn, Uri, workspace, window } from "vscode";
import { isResponseOk, softwareGet } from "../managers/HttpManager";
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

export function launchUrl(url: string, addHttpIfNotFound: boolean = true) {
    if (!url.toLowerCase().startsWith("http") && addHttpIfNotFound) {
        // add it
        url = `https://${url}`;
    }
    open(url);
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
    const displayedReadme = getItem("vscode_CtReadme");
    if (!displayedReadme || override) {
        const readmeUri = Uri.file(getLocalREADMEFile());

        commands.executeCommand("markdown.showPreview", readmeUri, ViewColumn.One);
        setItem("vscode_CtReadme", true);
    }
}

export function getItem(key: string) {
    const jsonObj = getSoftwareSessionAsJson();
    let val = jsonObj[key] || null;
    return val;
}

export function setItem(key: string, value: any) {
    const jsonObj = getSoftwareSessionAsJson();
    jsonObj[key] = value;

    const content = JSON.stringify(jsonObj);

    const sessionFile = getSoftwareSessionFile();
    fs.writeFileSync(sessionFile, content, (err: { message: any }) => {
        if (err) {
            logIt(`Error writing to the Software session file: ${err.message}`);
        }
    });
}

export function getSoftwareSessionAsJson() {
    let data = null;

    const sessionFile = getSoftwareSessionFile();
    if (fs.existsSync(sessionFile)) {
        const content = fs.readFileSync(sessionFile).toString();
        if (content) {
            try {
                data = JSON.parse(cleanJsonString(content));
            } catch (e) {
                logIt(`unable to read session info: ${e.message}`);
                data = {};
            }
        }
    }
    return data ? data : {};
}

export function getFileDataAsJson(file: string): any {
    let data = null;
    if (fs.existsSync(file)) {
        let content = fs.readFileSync(file).toString();
        if (content) {
            try {
                data = JSON.parse(cleanJsonString(content));
            } catch (e) {
                console.log(`unable to read session info: ${e.message}`);
            }
        }
    }
    return data;
}

export function openFileInEditor(file: string) {
    workspace.openTextDocument(file).then(
        doc => {
            // Show open document and set focus
            window.showTextDocument(doc, 1, false).then(undefined, (error: any) => {
                if (error.message) {
                    window.showErrorMessage(error.message);
                } else {
                    console.log(error);
                }
            });
        },
        (error: any) => {
            if (error.message && error.message.toLowerCase().includes("file not found")) {
                window.showErrorMessage(`Cannot open ${file}.  File not found.`);
            } else {
                console.log(error);
            }
        }
    );
}

export function cleanJsonString(content: string) {
    content = content.replace(/\r\n/g, "").replace(/\n/g, "").trim();
    return content;
}

export function nowInSecs() {
    return Math.round(Date.now() / 1000);
}

export async function getHostname() {
    let hostname = await getCommandResultLine("hostname");
    return hostname;
}

export async function getOsUsername() {
    let username = os.userInfo().username;
    if (!username || username.trim() === "") {
        username = await getCommandResultLine("whoami");
    }
    return username;
}

export async function getCommandResultLine(cmd: string, projectDir = null) {
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

export async function getCommandResultList(cmd: string, projectDir = null) {
    let result: string = await wrapExecPromise(`${cmd}`, projectDir);
    if (!result) {
        return [];
    }
    const contentList = result.replace(/\r\n/g, "\r").replace(/\n/g, "\r").split(/\r/);
    return contentList;
}

export async function wrapExecPromise(cmd: string, projectDir: any = ""): Promise<string> {
    let result: string = "";
    try {
        let opts = projectDir !== undefined && projectDir !== null && projectDir ? { cwd: projectDir } : {};
        result = await execPromise(cmd, opts).catch(e => {
            if (e.message) {
                console.log("task error: ", e.message);
            }
            return "";
        });
    } catch (e) {
        if (e.message) {
            console.log("task error: ", e.message);
        }
        result = "";
    }
    return result;
}

function execPromise(command: string, opts: any): Promise<string> {
    return new Promise(function (resolve, reject) {
        exec(command, opts, (error: any, stdout: any, stderr: any) => {
            if (error) {
                reject(error);
                return;
            }

            resolve(stdout.trim());
        });
    });
}

export function logIt(message: string) {
    console.log(`${getExtensionName()}: ${message}`);
}

export function isValidUrl(url: string) {
    const res = url.match(
        /(http(s)?:\/\/.)?(www\.)?[-a-zA-Z0-9@:%._\+~#=]{2,256}\.[a-z]{2,6}\b([-a-zA-Z0-9@:%_\+.~#?&//=]*)/g
    );
    return !res ? false : true;
}

/**
 * get the app jwt
 */
export async function getAppJwt(serverIsOnline: boolean) {
    if (serverIsOnline) {
        // get the app jwt
        let resp = await softwareGet(`/data/apptoken?token=${nowInSecs()}`);
        if (isResponseOk(resp)) {
            return resp.data.jwt;
        }
    }
    return null;
}

export function launchInputBox(placeHolder: string, usageMsg: string, isUrl: boolean = false) {
    return window.showInputBox({
        value: "",
        placeHolder,
        validateInput: text => {
            if (isUrl) {
                if (!text || !isValidUrl(text)) {
                    return usageMsg;
                }
            } else if (!text) {
                return usageMsg;
            }
            return null;
        }
    });
}
