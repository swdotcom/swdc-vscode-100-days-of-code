// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import { createCommands } from "./utils/CommandUtil";
import {
    checkMilestonesJson,
    deleteMilestoneJson
} from "./utils/MilestonesUtil";
import { checkLogsJson, getLatestLogEntryNumber, deleteLogsJson, resetPreviousLogIfEmpty } from "./utils/LogsUtil";
import { syncLogs } from "./utils/LogSync";
import { deleteSummaryJson } from "./utils/SummaryUtil";
import { deleteLogsPayloadJson } from "./utils/LogsDbUtils";
import {
    displayReadmeIfNotExists,
    isLoggedIn,
    setName,
    checkIfNameChanged,
} from "./utils/Util";
import { getPluginName, getVersion } from "./utils/PluginUtil";
import { commands } from "vscode";
import { TrackerManager } from "./managers/TrackerManager";
import { MilestoneEventManager } from "./managers/MilestoneEventManager";
import { fetchSummary } from "./utils/SummaryDbUtil";

const tracker: TrackerManager = TrackerManager.getInstance();

let five_minute_interval: NodeJS.Timeout;
let init_interval: NodeJS.Timeout;
let log_out_interval: NodeJS.Timeout;

const one_min_millis = 1000 * 60;

// this method is called when the extension is activated
export function activate(ctx: vscode.ExtensionContext) {
    // Use the console to output diagnostic information (console.log) and errors (console.error)
    // This line of code will only be executed once when your extension is activated
    console.log(`Loaded ${getPluginName()} v${getVersion()}`);

    // Initialize all the files and db setup for the plugin
    initializePlugin();

    // adding commands for 100 Days of code pages and events
    ctx.subscriptions.push(createCommands());
}

export async function initializePlugin() {
    // checks if all the files exist
    checkLogsJson();
    checkMilestonesJson();

    // Displays README on first launch
    displayReadmeIfNotExists();

    // init condition
    if (getLatestLogEntryNumber() <= 0) {
        commands.executeCommand("DoC.revealTree");
    }

    // initialize the milestone event manager
    const milestoneEventMgr: MilestoneEventManager = MilestoneEventManager.getInstance();

    // try to send payloads that weren't sent
    // and fetch data from the db as well

    if (isLoggedIn()) {
        setName();

        await syncLogs();

        // milestones
        milestoneEventMgr.fetchAllMilestones();

        // sets interval jobs
        initializeIntervalJobs();

        // clean up unused files
        deleteLogsPayloadJson();

        await fetchSummary();
    }

    // initialize tracker
    tracker.init();
}

function initializeIntervalJobs() {
    setLogOutInterval();

    // every 5 minutes perform the following
    five_minute_interval = setInterval(() => {
        if (checkIfNameChanged()) {
            logOut();
        } else {
            // make sure the last log isn't empty
            resetPreviousLogIfEmpty();

            // sync the logs
            syncLogs();
        }
    }, one_min_millis * 5);
}

function setLogOutInterval() {
    log_out_interval = setInterval(() => {
        if (checkIfNameChanged()) {
            logOut();
        }
    }, 10000);
}

function logOut() {
    // reset updates
    clearInterval(five_minute_interval);
    clearInterval(init_interval);

    // reset files
    deleteMilestoneJson();
    deleteLogsJson();
    deleteSummaryJson();
}

export function deactivate(ctx: vscode.ExtensionContext) {

    // clearing the the intervals for processes
    clearInterval(five_minute_interval);
    clearInterval(init_interval);
    clearInterval(log_out_interval);
}
