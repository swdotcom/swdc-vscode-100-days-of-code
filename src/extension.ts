// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import { createCommands } from "./utils/CommandUtil";
import {
    checkCodeTimeMetricsMilestonesAchieved,
    checkMilestonesJson,
    checkLanguageMilestonesAchieved,
    checkDaysMilestones,
    deleteMilestoneJson
} from "./utils/MilestonesUtil";
import {
    checkLogsJson,
    updateLogsMilestonesAndMetrics,
    getLatestLogEntryNumber,
    deleteLogsJson,
    resetPreviousLogIfEmpty
} from "./utils/LogsUtil";
import { syncLogs } from "./utils/LogSync";
import { reevaluateSummary, deleteSummaryJson } from "./utils/SummaryUtil";
import {
    checkMilestonesPayload,
    sentMilestonesDb,
    pushNewMilestones,
    updatedMilestonesDb,
    pushUpdatedMilestones,
    fetchMilestones,
    createMilestonesPayloadJson,
    deleteMilestonePayloadJson
} from "./utils/MilestonesDbUtil";
import { createLogsPayloadJson, deleteLogsPayloadJson } from "./utils/LogsDbUtils";
import { pushSummaryToDb, fetchSummary } from "./utils/SummaryDbUtil";
import {
    displayReadmeIfNotExists,
    isLoggedIn,
    setName,
    checkIfNameChanged,
    getPluginName,
    getVersion,
    sendHeartbeat
} from "./utils/Util";
import { commands } from "vscode";
import { TrackerManager } from "./managers/TrackerManager";

const tracker: TrackerManager = TrackerManager.getInstance();

let five_minute_interval: NodeJS.Timeout;
let one_hour_interval: NodeJS.Timeout;
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

export function initializePlugin() {
    // checks if all the files exist
    checkLogsJson();
    checkMilestonesJson();

    // Displays README on first launch
    displayReadmeIfNotExists();

    // init condition
    if (getLatestLogEntryNumber() <= 0) {
        commands.executeCommand("DoC.revealTree");
        sendHeartbeat("INSTALLED");
    }

    // try to send payloads that weren't sent
    // and fetch data from the db as well

    if (isLoggedIn()) {
        setName();

        syncLogs();

        // milestones
        checkMilestonesPayload();
        if (!sentMilestonesDb) {
            pushNewMilestones();
        }
        if (!updatedMilestonesDb) {
            pushUpdatedMilestones();
        }
        fetchMilestones(null, true);

        // fetches and updates the user summary in the db
        pushSummaryToDb();

        // sets interval jobs
        initializeIntervalJobs();
    } else {
        initializeLogInCheckInterval();
    }

    // initialize tracker
    tracker.init();
}

function initializeIntervalJobs() {
    setLogOutInterval();

    five_minute_interval = setInterval(() => {
        if (checkIfNameChanged()) {
            logOut();
        } else {
            resetPreviousLogIfEmpty();

            checkForMilestones();

            // milestones
            checkMilestonesPayload();

            if (!sentMilestonesDb) {
                pushNewMilestones();
            }
            if (!updatedMilestonesDb) {
                pushUpdatedMilestones();
            }
            fetchMilestones();

            // summary
            pushSummaryToDb();

            reevaluateSummary();
        }
    }, one_min_millis * 5);

    one_hour_interval = setInterval(() => {
        if (checkIfNameChanged()) {
            logOut();
        } else {
            syncLogs();
            if (updatedMilestonesDb && sentMilestonesDb) {
                fetchMilestones(null, true);
            } else if (!sentMilestonesDb) {
                pushNewMilestones();
            } else {
                pushUpdatedMilestones();
            }
        }
        sendHeartbeat("HOURLY");
    }, one_min_millis * 60);
}

function checkForMilestones() {
    // updates logs with latest metrics and checks for milestones
    updateLogsMilestonesAndMetrics([]);
    checkCodeTimeMetricsMilestonesAchieved();
    checkLanguageMilestonesAchieved();
    checkDaysMilestones();
}

function initializeLogInCheckInterval() {
    init_interval = setInterval(() => {
        if (isLoggedIn()) {
            setName();
            syncLogs();

            // milestones
            checkMilestonesPayload();
            if (!sentMilestonesDb) {
                pushNewMilestones();
            }
            if (!updatedMilestonesDb) {
                pushUpdatedMilestones();
            }
            fetchMilestones(null, true);

            // fetches and updates the user summary in the db
            pushSummaryToDb();

            // update the summary on init
            fetchSummary();

            clearInterval(init_interval);

            // sets interval jobs
            initializeIntervalJobs();
        }
    }, 10000);
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
    clearInterval(one_hour_interval);
    clearInterval(init_interval);

    // reset files
    deleteMilestoneJson();
    deleteMilestonePayloadJson();
    deleteLogsJson();
    deleteLogsPayloadJson();
    deleteSummaryJson();

    // restart init
    initializeLogInCheckInterval();
}

export function deactivate(ctx: vscode.ExtensionContext) {
    // creating payload files to store payloads that weren't sent
    createLogsPayloadJson();
    createMilestonesPayloadJson();

    // clearing the the intervals for processes
    clearInterval(five_minute_interval);
    clearInterval(one_hour_interval);
    clearInterval(init_interval);
    clearInterval(log_out_interval);
}
