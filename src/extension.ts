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
    deleteLogsJson
} from "./utils/LogsUtil";
import { checkSummaryJson, reevaluateSummary, deleteSummaryJson } from "./utils/SummaryUtil";
import {
    checkMilestonesPayload,
    sentMilestonesDb,
    pushNewMilestones,
    updatedMilestonesDb,
    pushUpdatedMilestones,
    fetchAllMilestones,
    fetchMilestonesForYesterdayAndToday,
    createMilestonesPayloadJson,
    deleteMilestonePayloadJson
} from "./utils/MilestonesDbUtil";
import {
    checkLogsPayload,
    sentLogsDb,
    pushNewLogs,
    updatedLogsDb,
    pushUpdatedLogs,
    fetchLogs,
    createLogsPayloadJson,
    deleteLogsPayloadJson
} from "./utils/LogsDbUtils";
import { pushSummaryToDb } from "./utils/SummaryDbUtil";
import { displayReadmeIfNotExists, isLoggedIn, setName, checkIfNameChanged } from "./utils/Util";
import { commands } from "vscode";

let one_minute_interval: NodeJS.Timeout;
let five_minute_interval: NodeJS.Timeout;
let one_hour_interval: NodeJS.Timeout;
let init_interval: NodeJS.Timeout;

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

    // Displays README on first launch
    displayReadmeIfNotExists();

    // init condition
    if (getLatestLogEntryNumber() <= 0) {
        commands.executeCommand("DoC.revealTree");
    }

    // try to send payloads that weren't sent
    // and fetch data from the db as well

    if (isLoggedIn()) {
        setName();
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
        reevaluateSummary();

        // sets interval jobs
        initializeIntervalJobs();
    } else {
        initializeLogInCheckInterval();
    }
}

function initializeIntervalJobs() {
    one_minute_interval = setInterval(async () => {
        if (checkIfNameChanged()) {
            logOut();
        } else {
            const currDate = new Date();
            if (currDate.getHours() !== 0 || currDate.getMinutes() > 3) {
                // updates logs with latest metrics and checks for milestones
                updateLogsMilestonesAndMetrics([]);
                checkCodeTimeMetricsMilestonesAchieved();
                checkLanguageMilestonesAchieved();
                checkDaysMilestones();
            }
        }
    }, one_min_millis);

    five_minute_interval = setInterval(async () => {
        if (checkIfNameChanged()) {
            logOut();
        } else {
            // logs
            checkLogsPayload();
            if (!sentLogsDb) {
                pushNewLogs(false);
            }
            if (!updatedLogsDb) {
                pushUpdatedLogs(false, 0);
            }
            await fetchLogs();

            // milestones
            checkMilestonesPayload();
            if (!sentMilestonesDb) {
                pushNewMilestones();
            }
            if (!updatedMilestonesDb) {
                pushUpdatedMilestones();
            }
            await fetchMilestonesForYesterdayAndToday();

            // summary
            await pushSummaryToDb();
        }
    }, one_min_millis * 1);

    one_hour_interval = setInterval(async () => {
        if (checkIfNameChanged()) {
            logOut();
        } else {
            if (updatedMilestonesDb && sentMilestonesDb) {
                fetchAllMilestones();
            } else if (!sentMilestonesDb) {
                pushNewMilestones();
            } else {
                pushUpdatedMilestones();
            }
        }
    }, one_min_millis * 60);
}

function initializeLogInCheckInterval() {
    init_interval = setInterval(() => {
        if (isLoggedIn()) {
            setName();
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
            reevaluateSummary();

            clearInterval(init_interval);

            // sets interval jobs
            initializeIntervalJobs();
        }
    }, 10000);
}

function logOut() {
    // reset updates
    clearInterval(one_minute_interval);
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
    clearInterval(one_minute_interval);
    clearInterval(five_minute_interval);
    clearInterval(one_hour_interval);
    clearInterval(init_interval);
}
