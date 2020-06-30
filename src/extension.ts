// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import { createCommands } from "./utils/CommandUtil";
import {
    checkCodeTimeMetricsMilestonesAchieved,
    checkMilestonesJson,
    checkLanguageMilestonesAchieved,
    checkDaysMilestones
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
import { checkSummaryJson, pushSummaryToDb } from "./utils/SummaryUtil";
import {
    checkMilestonesPayload,
    sentMilestonesDb,
    pushNewMilestones,
    updatedMilestonesDb,
    pushUpdatedMilestones,
    fetchAllMilestones,
    fetchMilestonesForYesterdayAndToday,
    createMilestonesPayloadJson
} from "./utils/MilestonesDbUtil";

let one_minute_interval: NodeJS.Timeout;
let five_minute_interval: NodeJS.Timeout;
let one_hour_interval: NodeJS.Timeout;

const one_min_millis = 1000 * 60;

// this method is called when the extension is activated
export function activate(ctx: vscode.ExtensionContext) {
    // Use the console to output diagnostic information (console.log) and errors (console.error)
    // This line of code will only be executed once when your extension is activated
    console.log("swdc-100-days-of-code: activated");

    // Initialize all the files and db setup for the plugin
    initializePlugin();

    // adding commands for 100 Days of code pages and events
    ctx.subscriptions.push(createCommands());
}

export async function initializePlugin() {
    // checks if all the files exist
    checkLogsJson();
    checkMilestonesJson();
    checkSummaryJson();

    // try to send payloads that weren't sent
    // and fetch data from the db as well

    // logs
    checkLogsPayload();
    if (!sentLogsDb) {
        pushNewLogs(false);
    }
    if (!updatedLogsDb) {
        pushUpdatedLogs(false, 0);
    }
    fetchLogs();

    // milestones
    checkMilestonesPayload();
    if (!sentMilestonesDb) {
        pushNewMilestones();
    }
    if (!updatedMilestonesDb) {
        pushUpdatedMilestones();
    }
    fetchAllMilestones();

    // fetches and updates the user summary in the db
    pushSummaryToDb();

    // updates logs and milestones
    updateLogsMilestonesAndMetrics([]);
    checkCodeTimeMetricsMilestonesAchieved();
    checkLanguageMilestonesAchieved();
    checkDaysMilestones();

    // sets interval jobs
    initializeIntervalJobs();
}

export function initializeIntervalJobs() {
    one_minute_interval = setInterval(async () => {
        // updates logs with latest metrics and checks for milestones
        updateLogsMilestonesAndMetrics([]);
        checkCodeTimeMetricsMilestonesAchieved();
        checkLanguageMilestonesAchieved();
        checkDaysMilestones();
    }, one_min_millis);

    five_minute_interval = setInterval(async () => {
        // try to send payloads that weren't sent
        // and fetch data from the db as well every 5 minutes

        // logs
        if (!sentLogsDb) {
            pushNewLogs(false);
        }
        if (!updatedLogsDb) {
            pushUpdatedLogs(false, 0);
        }
        fetchLogs();

        // milestones
        if (!sentMilestonesDb) {
            pushNewMilestones();
        }
        if (!updatedMilestonesDb) {
            pushUpdatedMilestones();
        }
        fetchMilestonesForYesterdayAndToday();

        // summary
        pushSummaryToDb();
    }, one_min_millis * 1);

    one_hour_interval = setInterval(async () => {
        // fetch all milestones for keeping them updated
        if (updatedMilestonesDb && sentMilestonesDb) {
            fetchAllMilestones();
        } else if (!sentMilestonesDb) {
            pushNewMilestones();
        } else {
            pushUpdatedMilestones();
        }
    }, one_min_millis * 60);
}

export function deactivate(ctx: vscode.ExtensionContext) {
    // creating payload files to store payloads that weren't sent
    createLogsPayloadJson();
    createMilestonesPayloadJson();

    // clearing the the intervals for processes
    clearInterval(one_minute_interval);
    clearInterval(five_minute_interval);
    clearInterval(one_hour_interval);
}
