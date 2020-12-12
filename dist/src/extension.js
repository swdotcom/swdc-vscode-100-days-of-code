"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deactivate = exports.initializePlugin = exports.activate = void 0;
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require("vscode");
const CommandUtil_1 = require("./utils/CommandUtil");
const MilestonesUtil_1 = require("./utils/MilestonesUtil");
const LogsUtil_1 = require("./utils/LogsUtil");
const LogsDbUtils_1 = require("./utils/LogsDbUtils");
const Util_1 = require("./utils/Util");
const PluginUtil_1 = require("./utils/PluginUtil");
const vscode_1 = require("vscode");
const TrackerManager_1 = require("./managers/TrackerManager");
const MilestoneEventManager_1 = require("./managers/MilestoneEventManager");
const SummaryDbUtil_1 = require("./utils/SummaryDbUtil");
const tracker = TrackerManager_1.TrackerManager.getInstance();
let five_minute_interval;
let init_interval;
let log_out_interval;
const one_min_millis = 1000 * 60;
// this method is called when the extension is activated
function activate(ctx) {
    // Use the console to output diagnostic information (console.log) and errors (console.error)
    // This line of code will only be executed once when your extension is activated
    console.log(`Loaded ${PluginUtil_1.getPluginName()} v${PluginUtil_1.getVersion()}`);
    // Initialize all the files and db setup for the plugin
    initializePlugin();
    // adding commands for 100 Days of code pages and events
    ctx.subscriptions.push(CommandUtil_1.createCommands());
}
exports.activate = activate;
function initializePlugin() {
    return __awaiter(this, void 0, void 0, function* () {
        // checks if all the files exist
        LogsUtil_1.checkLogsJson();
        MilestonesUtil_1.checkMilestonesJson();
        // Displays README on first launch
        Util_1.displayReadmeIfNotExists();
        // init condition
        if (LogsUtil_1.getLatestLogEntryNumber() <= 0) {
            vscode_1.commands.executeCommand("DoC.revealTree");
        }
        // initialize the milestone event manager
        const milestoneEventMgr = MilestoneEventManager_1.MilestoneEventManager.getInstance();
        // try to send payloads that weren't sent
        // and fetch data from the db as well
        if (Util_1.isLoggedIn()) {
            if (vscode.window.state.focused) {
                yield milestoneEventMgr.fetchAllMilestones();
                yield LogsUtil_1.syncLogs();
                // session summary
                yield SummaryDbUtil_1.fetchSummary();
            }
            // clean up unused files
            LogsDbUtils_1.deleteLogsPayloadJson();
        }
        // initialize tracker
        tracker.init();
    });
}
exports.initializePlugin = initializePlugin;
function deactivate(ctx) {
    // clearing the the intervals for processes
    clearInterval(five_minute_interval);
    clearInterval(init_interval);
    clearInterval(log_out_interval);
}
exports.deactivate = deactivate;
//# sourceMappingURL=extension.js.map