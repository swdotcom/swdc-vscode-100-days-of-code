// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import { createCommands } from "./utils/CommandUtil";
import {
    checkCodeTimeMetricsMilestonesAchieved,
    checkMilestonesJson,
    checkLanguageMilestonesAchieved,
    checkDaysMilestones,
    sentMilestonesDb,
    checkMilestonesPayload,
    updatedMilestonesDb,
    fetchAllMilestones,
    pushNewMilestones,
    pushUpdatedMilestones,
    fetchMilestonesForYesterdayAndToday,
    createMilestonesPayloadJson
} from "./utils/MilestonesUtil";
import {
    checkLogsJson,
    updateLogsMilestonesAndMetrics,
    fetchLogs,
    updatedLogsDb,
    pushNewLogs,
    sentLogsDb,
    pushUpdatedLogs,
    createLogsPayloadJson,
    checkLogsPayload
} from "./utils/LogsUtil";
import { checkUserJson } from "./utils/UserUtil";

let one_minute_interval: NodeJS.Timeout;
let five_minute_interval: NodeJS.Timeout;

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

    // checks if any payloads remained
    checkLogsPayload();
    if (updatedLogsDb && sentLogsDb) {
        fetchLogs();
    } else if (!sentLogsDb) {
        pushNewLogs(false);
    } else {
        pushUpdatedLogs(false, 0);
    }

    checkMilestonesPayload();
    if (updatedMilestonesDb && sentMilestonesDb) {
        fetchAllMilestones();
    } else if (!sentMilestonesDb) {
        pushNewMilestones();
    } else {
        pushUpdatedMilestones();
    }

    // Updates logs and milestones
    updateLogsMilestonesAndMetrics([]);
    checkCodeTimeMetricsMilestonesAchieved();
    checkLanguageMilestonesAchieved();
    checkDaysMilestones();

    // Sets interval jobs
    initializeIntervalJobs();
}

export function initializeIntervalJobs() {
    // every 1 minute tasks
    one_minute_interval = setInterval(async () => {
        // updates logs with latest metrics
        updateLogsMilestonesAndMetrics([]);
        checkCodeTimeMetricsMilestonesAchieved();
        checkLanguageMilestonesAchieved();
        checkDaysMilestones();
    }, one_min_millis);

    five_minute_interval = setInterval(async () => {
        // logs
        if (updatedLogsDb && sentLogsDb) {
            fetchLogs();
        } else if (!sentLogsDb) {
            pushNewLogs(false);
        } else {
            pushUpdatedLogs(false, 0);
        }
        // milestones
        if (updatedMilestonesDb && sentMilestonesDb) {
            fetchMilestonesForYesterdayAndToday();
        } else if (!sentMilestonesDb) {
            pushNewMilestones();
        } else {
            pushUpdatedMilestones();
        }
    }, one_min_millis * 1);
}

// this method is called when your extension is deactivated
export function deactivate(ctx: vscode.ExtensionContext) {
    createLogsPayloadJson();
    createMilestonesPayloadJson();
    clearInterval(one_minute_interval);
    clearInterval(five_minute_interval);
}
