// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import { createCommands } from "./utils/CommandUtil";
import {
    checkMilestonesJson
} from "./utils/MilestonesUtil";
import { checkLogsJson, getLatestLogEntryNumber, resetPreviousLogIfEmpty, syncLogs } from "./utils/LogsUtil";
import { deleteLogsPayloadJson } from "./utils/LogsDbUtils";
import {
    displayReadmeIfNotExists,
    isLoggedIn,
    checkIfNameChanged,
    resetData,
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

        if (vscode.window.state.focused) {
          await milestoneEventMgr.fetchAllMilestones();

          await syncLogs();

          // session summary
          await fetchSummary();
        }

        // clean up unused files
        deleteLogsPayloadJson();
    }

    // initialize tracker
    tracker.init();
}


export function deactivate(ctx: vscode.ExtensionContext) {

    // clearing the the intervals for processes
    clearInterval(five_minute_interval);
    clearInterval(init_interval);
    clearInterval(log_out_interval);
}
