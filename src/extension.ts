// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import { createCommands } from "./utils/CommandUtil";
import {
    checkCodeTimeMetricsMilestonesAchieved,
    checkMilestonesJson,
    checkLanguageMilestonesAchieved
} from "./utils/MilestonesUtil";
import { checkLogsJson, updateLogsMilestonesAndMetrics } from "./utils/LogsUtil";
import { checkUserJson } from "./utils/UserUtil";

let one_minute_interval: NodeJS.Timeout;

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
    updateLogsMilestonesAndMetrics([]);
    checkCodeTimeMetricsMilestonesAchieved();
    checkLanguageMilestonesAchieved();

    // Setup interval jobs
    initializeIntervalJobs();
}

export function initializeIntervalJobs() {
    // every 1 minute tasks
    one_minute_interval = setInterval(async () => {
        // updates logs with latest metrics
        updateLogsMilestonesAndMetrics([]);
        checkCodeTimeMetricsMilestonesAchieved();
        checkLanguageMilestonesAchieved();
    }, one_min_millis);
}

// this method is called when your extension is deactivated
export function deactivate(ctx: vscode.ExtensionContext) {
    clearInterval(one_minute_interval);
}
