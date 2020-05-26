import { commands, ViewColumn, Uri, workspace, window } from "vscode";
import { ZoomInfo } from "../models/ZoomInfo";
import { isResponseOk, softwareGet, zoomGet } from "../managers/HttpManager";
import { api_endpoint } from "./Constants";

const fs = require("fs");
const os = require("os");
const open = require("open");
const { exec } = require("child_process");

let zoomFetchTimeout: any;

export function getExtensionName() {
    return "zoom-time";
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

export function displayReadmeIfNotExists(
    override = false,
    launchTreeOnInit = false
) {
    const displayedReadme = getItem("vscode_ZtReadme");
    if (!displayedReadme || override) {
        if (!displayedReadme && launchTreeOnInit) {
            // reveal the tree
            commands.executeCommand("zoomtime.displayTree");
        }

        const readmeUri = Uri.file(getLocalREADMEFile());

        commands.executeCommand(
            "markdown.showPreview",
            readmeUri,
            ViewColumn.One
        );
        setItem("vscode_ZtReadme", true);
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

export function writeJsonData(data: ZoomInfo[], file: string) {
    try {
        const content = JSON.stringify(data, null, 4);
        fs.writeFileSync(file, content, (err: { message: any }) => {
            if (err) {
                console.log(`error writing data: ${err.message}`);
            }
        });
    } catch (e) {
        console.log(`error writing data: ${e.message}`);
    }
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
            window
                .showTextDocument(doc, 1, false)
                .then(undefined, (error: any) => {
                    if (error.message) {
                        window.showErrorMessage(error.message);
                    } else {
                        console.log(error);
                    }
                });
        },
        (error: any) => {
            if (
                error.message &&
                error.message.toLowerCase().includes("file not found")
            ) {
                window.showErrorMessage(
                    `Cannot open ${file}.  File not found.`
                );
            } else {
                console.log(error);
            }
        }
    );
}

export function cleanJsonString(content: string) {
    content = content
        .replace(/\r\n/g, "")
        .replace(/\n/g, "")
        .trim();
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
    const contentList = result
        .replace(/\r\n/g, "\r")
        .replace(/\n/g, "\r")
        .split(/\r/);
    return contentList;
}

export async function wrapExecPromise(
    cmd: string,
    projectDir: any = ""
): Promise<string> {
    let result: string = "";
    try {
        let opts =
            projectDir !== undefined && projectDir !== null && projectDir
                ? { cwd: projectDir }
                : {};
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
    return new Promise(function(resolve, reject) {
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

export async function connectZoom() {
    const zoomAccessToken = getItem("zoom_access_token");
    if (zoomAccessToken) {
        // there's already an access token
        window.showInformationMessage(`You have already connected Zoom.`);
        commands.executeCommand("zoomtime.refreshTree");
        return;
    }

    let jwt = getItem("jwt");
    if (!jwt) {
        // no jwt, get the app jwt
        jwt = await getAppJwt(true);
        await setItem("jwt", jwt);
    }

    jwt = getItem("jwt");
    if (!jwt) {
        return window.showInformationMessage(
            `Our service is temporarily unavailable.\n\nPlease try again later.\n`
        );
    }

    const encodedJwt = encodeURIComponent(jwt);
    const connectUrl = `${api_endpoint}/auth/zoom?token=${encodedJwt}`;
    launchUrl(connectUrl);
    refetchZoomConnectStatusLazily();
}

export function refetchZoomConnectStatusLazily(
    tryCountUntilFound: number = 40
) {
    if (zoomFetchTimeout) {
        return;
    }
    // try again in 10 seconds
    zoomFetchTimeout = setTimeout(() => {
        zoomFetchTimeout = null;
        zoomConnectStatusHandler(tryCountUntilFound);
    }, 10000);
}

async function zoomConnectStatusHandler(tryCountUntilFound: number) {
    let oauthResult = await getZoomTimeUserStatus();
    if (!oauthResult.loggedOn) {
        // try again if the count is not zero
        if (tryCountUntilFound > 0) {
            tryCountUntilFound -= 1;
            refetchZoomConnectStatusLazily(tryCountUntilFound);
        }
    } else {
        window.showInformationMessage("Successfully connected to Zoom");
        // refresh the tree
        commands.executeCommand("zoomtime.refreshTree");
    }
}

export async function getZoomTimeUserStatus() {
    // We don't have a user yet, check the users via the plugin/state
    const jwt = getItem("jwt");
    const zoom_refresh_token = getItem("zoom_refresh_token");

    if (jwt || zoom_refresh_token) {
        const api = "/users/plugin/state";
        const additionalHeaders: any = zoom_refresh_token
            ? { zoom_refresh_token }
            : null;
        const resp = await softwareGet(api, jwt, additionalHeaders);
        if (isResponseOk(resp) && resp.data) {
            // NOT_FOUND, ANONYMOUS, OK, UNKNOWN
            const state = resp.data.state ? resp.data.state : "UNKNOWN";
            if (state === "OK") {
                /**
                 * stateData only contains:
                 * {email, jwt, state}
                 */
                const stateData = resp.data;
                if (stateData.email) {
                    setItem("name", stateData.email);
                }
                // check the jwt
                if (stateData.jwt) {
                    // update it
                    setItem("jwt", stateData.jwt);
                }

                // get the user from the payload
                const user = resp.data.user;
                let foundZoomAuth = false;

                if (user.auths && user.auths.length > 0) {
                    for (let i = 0; i < user.auths.length; i++) {
                        const auth = user.auths[i];

                        // update the zoom access info if the auth matches
                        if (auth.type === "zoom" && auth.access_token) {
                            foundZoomAuth = true;
                            setItem("zoom_access_token", auth.access_token);
                            setItem("zoom_refresh_token", auth.refresh_token);
                            break;
                        }
                    }
                }

                return { loggedOn: foundZoomAuth, state };
            }
            // return the state that is returned
            return { loggedOn: false, state };
        }
    }
    return { loggedOn: false, state: "UNKNOWN" };
}

export function launchInputBox(
    placeHolder: string,
    usageMsg: string,
    isUrl: boolean = false
) {
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
