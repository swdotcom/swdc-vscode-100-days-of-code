// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import { createCommands } from "./utils/CommandUtil";
import { checkMilestonesJson } from "./utils/MilestonesUtil";
import { syncLogs } from "./utils/LogsUtil";
import { displayReadmeIfNotExists, isLoggedIn, getMillisSinceLastUpdate } from "./utils/Util";
import { getPluginName, getVersion } from "./utils/PluginUtil";
import { TrackerManager } from "./managers/TrackerManager";
import { MilestoneEventManager } from "./managers/MilestoneEventManager";
import { fetchSummary } from "./utils/SummaryDbUtil";
import { getSummaryJsonFilePath } from "./managers/FileManager";

const tracker: TrackerManager = TrackerManager.getInstance();
const thirty_seconds = 1000 * 30;
let milestoneMgr: MilestoneEventManager;

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
  checkMilestonesJson();

  // Displays README on first launch
  displayReadmeIfNotExists();

  // this needs to be done on any parent or child window to initiate the file event listening logic
  milestoneMgr = MilestoneEventManager.getInstance();

  // initialize logs, summary, and milestone data if its the primary window
  if (isLoggedIn()) {
    // This is important to initialize in order to obtain the challenge round
    // if its not already in memory
    const millisSinceUpdate = getMillisSinceLastUpdate(getSummaryJsonFilePath());
    if (isThresholdMet(millisSinceUpdate)) {
      // initialize the user summary info (challenge_round and metrics data)
      await fetchSummary();
      await syncLogs();
      await milestoneMgr.fetchAllMilestones();
    }
  }
  // initialize tracker
  tracker.init();
}

function isThresholdMet(millisSinceUpdate) {
  return millisSinceUpdate === -1 || millisSinceUpdate > thirty_seconds;
}

export function deactivate(ctx: vscode.ExtensionContext) {
  // add deactivate functionality here
  if (milestoneMgr) {
    milestoneMgr.dispose();
  }
}
