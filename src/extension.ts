// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import { createCommands } from "./utils/CommandUtil";
import {
    checkCodeTimeMetricsMilestonesAchieved,
    checkMilestonesJson,
    checkLanguageMilestonesAchieved
} from "./utils/MilestonesUtil";
import { checkLogsJson } from "./utils/LogsUtil";
import { checkUserJson, updateUserLanguages } from "./utils/UserUtil";

let fifteen_minute_interval: NodeJS.Timeout;

const one_min_millis = 1000 * 60;

// this method is called when the extension is activated
export function activate(ctx: vscode.ExtensionContext) {
    // Use the console to output diagnostic information (console.log) and errors (console.error)
    // This line of code will only be executed once when your extension is activated
    console.log('"100 days of code time" is now active');

    initializePlugin();

    // add the code time commands
    ctx.subscriptions.push(createCommands());
}

export function initializePlugin() {
    // Checks if all the files exist
    checkLogsJson();
    checkMilestonesJson();
    checkUserJson();

    // Setup interval jobs
    initializeIntervalJobs();
}

export function initializeIntervalJobs() {
    // every 15 minute tasks
    fifteen_minute_interval = setInterval(async () => {
        console.log("CHECKED MILESTONES");
        checkCodeTimeMetricsMilestonesAchieved();
        updateUserLanguages();
        checkLanguageMilestonesAchieved();
    }, one_min_millis * 15);
}

// this method is called when your extension is deactivated
export function deactivate(ctx: vscode.ExtensionContext) {
    clearInterval(fifteen_minute_interval);
}
