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
exports.createCommands = exports.reloadCurrentView = void 0;
const vscode_1 = require("vscode");
const Tree100DoCProvider_1 = require("../tree/Tree100DoCProvider");
const LogsUtil_1 = require("./LogsUtil");
const MilestonesUtil_1 = require("./MilestonesUtil");
const addLogUtil_1 = require("./addLogUtil");
const DashboardUtil_1 = require("./DashboardUtil");
const Util_1 = require("./Util");
const MilestonesTemplateUtil_1 = require("./MilestonesTemplateUtil");
const SummaryDbUtil_1 = require("./SummaryDbUtil");
const LogsTemplateUtil_1 = require("./LogsTemplateUtil");
const TrackerManager_1 = require("../managers/TrackerManager");
const LogsUtil_2 = require("./LogsUtil");
const MilestoneEventManager_1 = require("../managers/MilestoneEventManager");
let currentTitle = "";
function reloadCurrentView() {
    if (currentTitle) {
        switch (currentTitle) {
            case "Logs":
                vscode_1.commands.executeCommand("DoC.viewLogs");
                break;
            case "Dashboard":
                vscode_1.commands.executeCommand("DoC.viewDashboard");
                break;
            case "Milestones":
                vscode_1.commands.executeCommand("DoC.viewMilestones");
                break;
        }
    }
}
exports.reloadCurrentView = reloadCurrentView;
function createCommands() {
    let cmds = [];
    let currentPanel = undefined;
    const Doc100SftwProvider = new Tree100DoCProvider_1.Tree100DoCProvider();
    const Doc100SftwTreeView = vscode_1.window.createTreeView("100DoC-tree", {
        treeDataProvider: Doc100SftwProvider,
        showCollapseAll: true
    });
    Doc100SftwProvider.bindView(Doc100SftwTreeView);
    cmds.push(Tree100DoCProvider_1.connectDoCTreeView(Doc100SftwTreeView));
    cmds.push(vscode_1.commands.registerCommand("DoC.ViewReadme", () => {
        Util_1.displayReadmeIfNotExists(true);
    }));
    cmds.push(vscode_1.commands.registerCommand("DoC.revealTree", () => {
        Doc100SftwProvider.revealTree();
    }));
    cmds.push(vscode_1.commands.registerCommand("DoC.viewLogs", () => __awaiter(this, void 0, void 0, function* () {
        // check if the user has changed accounts
        yield Util_1.checkIfNameChanged();
        const generatedHtml = LogsTemplateUtil_1.getUpdatedLogsHtml();
        const title = "Logs";
        if (currentPanel && title !== currentTitle) {
            // dipose the previous one
            currentPanel.dispose();
        }
        currentTitle = title;
        if (!currentPanel) {
            currentPanel = vscode_1.window.createWebviewPanel("100doc", title, vscode_1.ViewColumn.One, { enableScripts: true });
            currentPanel.onDidDispose(() => {
                currentPanel = undefined;
            });
            currentPanel.webview.onDidReceiveMessage((message) => __awaiter(this, void 0, void 0, function* () {
                if (!Util_1.isLoggedIn()) {
                    Util_1.displayLoginPromptIfNotLoggedIn();
                }
                switch (message.command) {
                    case "editLog":
                        const dayUpdate = message.value;
                        yield LogsUtil_1.editLogEntry(parseInt(dayUpdate.day_number), dayUpdate.title, dayUpdate.description, dayUpdate.links, dayUpdate.hours);
                        yield LogsUtil_2.syncLogs();
                        vscode_1.commands.executeCommand("DoC.viewLogs");
                        break;
                    case "addLog":
                        TrackerManager_1.TrackerManager.getInstance().trackUIInteraction("click", "100doc_add_log_btn", "100doc_logs_view", "blue", "", "Add Log");
                        vscode_1.commands.executeCommand("DoC.addLog");
                        break;
                    case "incrementShare":
                        TrackerManager_1.TrackerManager.getInstance().trackUIInteraction("click", "100doc_share_log_btn", "100doc_logs_view", "", "share", "");
                        LogsUtil_1.updateLogShare(message.value);
                        MilestonesUtil_1.checkSharesMilestones();
                        break;
                    case "deleteLog":
                        const selection = yield vscode_1.window.showInformationMessage("Are you sure you want to delete this log?", { modal: true }, ...["Yes"]);
                        if (selection && selection === "Yes") {
                            vscode_1.commands.executeCommand("DoC.deleteLog", message.value);
                        }
                        break;
                    case "refreshView":
                        // refresh the logs then show it again
                        yield LogsUtil_2.syncLogs();
                        if (currentPanel) {
                            // dipose the previous one
                            currentPanel.dispose();
                        }
                        vscode_1.commands.executeCommand("DoC.viewLogs");
                        break;
                }
            }));
        }
        currentPanel.webview.html = generatedHtml;
        currentPanel.reveal(vscode_1.ViewColumn.One);
        Util_1.displayLoginPromptIfNotLoggedIn();
    })));
    cmds.push(vscode_1.commands.registerCommand("DoC.deleteLog", (unix_day) => {
        // send the delete request
        LogsUtil_2.deleteLogDay(unix_day);
    }));
    cmds.push(vscode_1.commands.registerCommand("DoC.viewDashboard", () => __awaiter(this, void 0, void 0, function* () {
        // check if the user has changed accounts
        yield Util_1.checkIfNameChanged();
        const generatedHtml = DashboardUtil_1.getUpdatedDashboardHtmlString();
        const title = "Dashboard";
        if (currentPanel && title !== currentTitle) {
            // dipose the previous one
            currentPanel.dispose();
        }
        currentTitle = title;
        if (!currentPanel) {
            currentPanel = vscode_1.window.createWebviewPanel("100doc", title, vscode_1.ViewColumn.One, { enableScripts: true });
            currentPanel.onDidDispose(() => {
                currentPanel = undefined;
            });
            currentPanel.webview.onDidReceiveMessage((message) => __awaiter(this, void 0, void 0, function* () {
                switch (message.command) {
                    case "Logs":
                        vscode_1.commands.executeCommand("DoC.viewLogs");
                        TrackerManager_1.TrackerManager.getInstance().trackUIInteraction("click", "100doc_logs_btn", "100doc_dashboard_view", "", "", "View Logs");
                        break;
                    case "ShareProgress":
                        TrackerManager_1.TrackerManager.getInstance().trackUIInteraction("click", "100doc_share_progress_btn", "100doc_dashboard_view", "blue", "", "Share progress");
                        break;
                    case "Milestones":
                        vscode_1.commands.executeCommand("DoC.viewMilestones");
                        TrackerManager_1.TrackerManager.getInstance().trackUIInteraction("click", "100doc_milestones_btn", "100doc_dashboard_view", "", "", "View Milestones");
                        break;
                    case "Certificate":
                        vscode_1.window
                            .showInputBox({
                            placeHolder: "Your name",
                            prompt: "Please enter your name for getting the certificate. Please make sure that you are connected to the internet."
                        })
                            .then(text => {
                            if (text) {
                                const panel = vscode_1.window.createWebviewPanel("Congratulations!", "Congratulations!", vscode_1.ViewColumn.One);
                                panel.webview.html = DashboardUtil_1.getCertificateHtmlString(text);
                                panel.reveal(vscode_1.ViewColumn.One);
                            }
                        });
                    case "refreshView":
                        // refresh the logs then show it again
                        yield SummaryDbUtil_1.fetchSummary();
                        if (currentPanel) {
                            // dipose the previous one
                            currentPanel.dispose();
                        }
                        vscode_1.commands.executeCommand("DoC.viewDashboard");
                        break;
                }
            }));
        }
        currentPanel.webview.html = generatedHtml;
        currentPanel.reveal(vscode_1.ViewColumn.One);
        Util_1.displayLoginPromptIfNotLoggedIn();
    })));
    cmds.push(vscode_1.commands.registerCommand("DoC.viewMilestones", () => __awaiter(this, void 0, void 0, function* () {
        // check if the user has changed accounts
        yield Util_1.checkIfNameChanged();
        if (Util_1.isLoggedIn()) {
            MilestonesUtil_1.checkCodeTimeMetricsMilestonesAchieved();
            MilestonesUtil_1.checkLanguageMilestonesAchieved();
            MilestonesUtil_1.checkDaysMilestones();
        }
        const generatedHtml = MilestonesTemplateUtil_1.getUpdatedMilestonesHtmlString();
        const title = "Milestones";
        if (currentPanel && title !== currentTitle) {
            // dipose the previous one
            currentPanel.dispose();
        }
        currentTitle = title;
        if (!currentPanel) {
            currentPanel = vscode_1.window.createWebviewPanel("100doc", title, vscode_1.ViewColumn.One, { enableScripts: true });
            currentPanel.onDidDispose(() => {
                currentPanel = undefined;
            });
            currentPanel.webview.onDidReceiveMessage((message) => __awaiter(this, void 0, void 0, function* () {
                switch (message.command) {
                    case "incrementShare":
                        TrackerManager_1.TrackerManager.getInstance().trackUIInteraction("click", "100doc_share_milestone_btn", "100doc_milestones_view", "", "share", "");
                        MilestonesUtil_1.updateMilestoneShare(message.value);
                        MilestonesUtil_1.checkSharesMilestones();
                        break;
                    case "refreshView":
                        // refresh the milestones
                        yield MilestoneEventManager_1.MilestoneEventManager.getInstance().fetchAllMilestones();
                        if (currentPanel) {
                            // dipose the previous one
                            currentPanel.dispose();
                        }
                        vscode_1.commands.executeCommand("DoC.viewMilestones");
                        break;
                }
            }));
        }
        currentPanel.webview.html = generatedHtml;
        currentPanel.reveal(vscode_1.ViewColumn.One);
        Util_1.displayLoginPromptIfNotLoggedIn();
    })));
    cmds.push(vscode_1.commands.registerCommand("DoC.addLog", () => {
        const generatedHtml = addLogUtil_1.getUpdatedAddLogHtmlString();
        const title = "Add Daily Progress Log";
        if (currentPanel && title !== currentTitle) {
            // dipose the previous one
            currentPanel.dispose();
        }
        currentTitle = title;
        if (!currentPanel) {
            currentPanel = vscode_1.window.createWebviewPanel("100doc", title, vscode_1.ViewColumn.One, { enableScripts: true });
            currentPanel.onDidDispose(() => {
                currentPanel = undefined;
            });
            // handle submit or cancel
            let log;
            currentPanel.webview.onDidReceiveMessage((message) => __awaiter(this, void 0, void 0, function* () {
                switch (message.command) {
                    // no need to add a cancel, just show the logs as a default
                    case "log":
                        if (Util_1.isLoggedIn()) {
                            log = message.value;
                            // this posts the log create/update to the server as well
                            yield LogsUtil_1.addLogToJson(log.title, log.description, log.hours, log.keystrokes, log.lines, log.links);
                            MilestonesUtil_1.checkLanguageMilestonesAchieved();
                            MilestonesUtil_1.checkDaysMilestones();
                            yield LogsUtil_2.syncLogs();
                        }
                        else {
                            Util_1.displayLoginPromptIfNotLoggedIn();
                        }
                        break;
                }
                vscode_1.commands.executeCommand("DoC.viewLogs");
            }));
        }
        currentPanel.webview.html = generatedHtml;
        currentPanel.reveal(vscode_1.ViewColumn.One);
    }));
    cmds.push(vscode_1.commands.registerCommand("DoC.showInfoMessage", (tile, message, isModal, commandCallback) => {
        vscode_1.window
            .showInformationMessage(message, {
            modal: isModal
        }, tile)
            .then(selection => {
            if (commandCallback && selection === tile) {
                vscode_1.commands.executeCommand(commandCallback);
            }
        });
    }));
    return vscode_1.Disposable.from(...cmds);
}
exports.createCommands = createCommands;
//# sourceMappingURL=CommandUtil.js.map