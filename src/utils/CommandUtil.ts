import { Disposable, commands, window, TreeView, ViewColumn, WebviewPanel } from "vscode";
import { TreeNode } from "../models/TreeNode";
import { Tree100DoCProvider, connectDoCTreeView } from "../tree/Tree100DoCProvider";
import { addLogToJson, editLogEntry, updateLogShare } from "./LogsUtil";
import {
    checkDaysMilestones,
    checkLanguageMilestonesAchieved,
    checkCodeTimeMetricsMilestonesAchieved,
    updateMilestoneShare,
    checkSharesMilestones
} from "./MilestonesUtil";
import { getUpdatedAddLogHtmlString } from "./addLogUtil";
import { getUpdatedDashboardHtmlString, getCertificateHtmlString } from "./DashboardUtil";
import { displayReadmeIfNotExists, displayLoginPromptIfNotLoggedIn, isLoggedIn } from "./Util";
import { getUpdatedMilestonesHtmlString } from "./MilestonesTemplateUtil";
import { getUpdatedLogsHtml } from "./LogsTemplateUtil";
import { TrackerManager } from "../managers/TrackerManager";
import { deleteLogDay, syncLogs } from "./LogSync";

export function createCommands(): { dispose: () => void } {
    let cmds: any[] = [];
    let currentPanel: WebviewPanel | undefined = undefined;
    let currentTitle: string = "";

    const Doc100SftwProvider = new Tree100DoCProvider();
    const Doc100SftwTreeView: TreeView<TreeNode> = window.createTreeView("100DoC-tree", {
        treeDataProvider: Doc100SftwProvider,
        showCollapseAll: true
    });
    Doc100SftwProvider.bindView(Doc100SftwTreeView);
    cmds.push(connectDoCTreeView(Doc100SftwTreeView));

    cmds.push(
        commands.registerCommand("DoC.ViewReadme", () => {
            displayReadmeIfNotExists(true);
        })
    );

    cmds.push(
        commands.registerCommand("DoC.revealTree", () => {
            Doc100SftwProvider.revealTree();
        })
    );

    cmds.push(
        commands.registerCommand("DoC.viewLogs", () => {
            const generatedHtml = getUpdatedLogsHtml();

            const title = "Logs";
            if (currentPanel && title !== currentTitle) {
                // dipose the previous one
                currentPanel.dispose();
            }

            if (!currentPanel) {
                currentPanel = window.createWebviewPanel("100doc", title, ViewColumn.One, { enableScripts: true });
                currentPanel.onDidDispose(() => {
                    currentPanel = undefined;
                });
                currentPanel.webview.onDidReceiveMessage(async message => {
                    switch (message.command) {
                        case "editLog":
                            const dayUpdate = message.value;

                            editLogEntry(
                                parseInt(dayUpdate.day_number),
                                dayUpdate.title,
                                dayUpdate.description,
                                dayUpdate.links,
                                dayUpdate.hours
                            );
                            await syncLogs();
                            commands.executeCommand("DoC.viewLogs");
                            break;
                        case "addLog":
                            TrackerManager.getInstance().trackUIInteraction(
                                "click",
                                "100doc_add_log_btn",
                                "100doc_logs_view",
                                "blue",
                                "",
                                "Add Log"
                            );

                            if (isLoggedIn()) {
                                commands.executeCommand("DoC.addLog");
                            } else if (!isLoggedIn()) {
                                displayLoginPromptIfNotLoggedIn();
                            }
                            break;
                        case "incrementShare":
                            TrackerManager.getInstance().trackUIInteraction(
                                "click",
                                "100doc_share_log_btn",
                                "100doc_logs_view",
                                "",
                                "share",
                                ""
                            );
                            updateLogShare(message.value);
                            checkSharesMilestones();
                            break;
                        case "deleteLog":
                            commands.executeCommand("DoC.deleteLog", message.value);
                            break;
                    }
                });
            }
            currentPanel.webview.html = generatedHtml;
            currentPanel.reveal(ViewColumn.One);

            displayLoginPromptIfNotLoggedIn();
        })
    );

    cmds.push(
        commands.registerCommand("DoC.deleteLog", (unix_day: number) => {
            // send the delete request
            deleteLogDay(unix_day);
        })
    );

    cmds.push(
        commands.registerCommand("DoC.viewDashboard", () => {
            const generatedHtml = getUpdatedDashboardHtmlString();

            const title = "Dashboard";
            if (currentPanel && title !== currentTitle) {
                // dipose the previous one
                currentPanel.dispose();
            }

            if (!currentPanel) {
                currentPanel = window.createWebviewPanel("100doc", title, ViewColumn.One, { enableScripts: true });
                currentPanel.onDidDispose(() => {
                    currentPanel = undefined;
                });

                currentPanel.webview.onDidReceiveMessage(message => {
                    switch (message.command) {
                        case "Logs":
                            commands.executeCommand("DoC.viewLogs");
                            TrackerManager.getInstance().trackUIInteraction(
                                "click",
                                "100doc_logs_btn",
                                "100doc_dashboard_view",
                                "",
                                "",
                                "View Logs"
                            );
                            break;
                        case "ShareProgress":
                            TrackerManager.getInstance().trackUIInteraction(
                                "click",
                                "100doc_share_progress_btn",
                                "100doc_dashboard_view",
                                "blue",
                                "",
                                "Share progress"
                            );
                            break;
                        case "Milestones":
                            commands.executeCommand("DoC.viewMilestones");
                            TrackerManager.getInstance().trackUIInteraction(
                                "click",
                                "100doc_milestones_btn",
                                "100doc_dashboard_view",
                                "",
                                "",
                                "View Milestones"
                            );
                            break;
                        case "Certificate":
                            window
                                .showInputBox({
                                    placeHolder: "Your name",
                                    prompt:
                                        "Please enter your name for getting the certificate. Please make sure that you are connected to the internet."
                                })
                                .then(text => {
                                    if (text) {
                                        const panel = window.createWebviewPanel(
                                            "Congratulations!",
                                            "Congratulations!",
                                            ViewColumn.One
                                        );
                                        panel.webview.html = getCertificateHtmlString(text);
                                        panel.reveal(ViewColumn.One);
                                    }
                                });
                    }
                });
            }

            currentPanel.webview.html = generatedHtml;
            currentPanel.reveal(ViewColumn.One);

            displayLoginPromptIfNotLoggedIn();
        })
    );

    cmds.push(
        commands.registerCommand("DoC.viewMilestones", () => {
            if (isLoggedIn()) {
                checkCodeTimeMetricsMilestonesAchieved();
                checkLanguageMilestonesAchieved();
                checkDaysMilestones();
            }

            const generatedHtml = getUpdatedMilestonesHtmlString();

            const title = "Milestones";
            if (currentPanel && title !== currentTitle) {
                // dipose the previous one
                currentPanel.dispose();
            }

            if (!currentPanel) {
                currentPanel = window.createWebviewPanel("100doc", title, ViewColumn.One, { enableScripts: true });
                currentPanel.onDidDispose(() => {
                    currentPanel = undefined;
                });

                currentPanel.webview.onDidReceiveMessage(message => {
                    switch (message.command) {
                        case "incrementShare":
                            TrackerManager.getInstance().trackUIInteraction(
                                "click",
                                "100doc_share_milestone_btn",
                                "100doc_milestones_view",
                                "",
                                "share",
                                ""
                            );
                            updateMilestoneShare(message.value);
                            checkSharesMilestones();
                            break;
                    }
                });
            }

            currentPanel.webview.html = generatedHtml;
            currentPanel.reveal(ViewColumn.One);

            displayLoginPromptIfNotLoggedIn();
        })
    );

    cmds.push(
        commands.registerCommand("DoC.addLog", () => {
            const generatedHtml = getUpdatedAddLogHtmlString();

            const title = "Add Daily Progress Log";
            if (currentPanel && title !== currentTitle) {
                // dipose the previous one
                currentPanel.dispose();
            }

            if (!currentPanel) {
                currentPanel = window.createWebviewPanel("100doc", title, ViewColumn.One, { enableScripts: true });
                currentPanel.onDidDispose(() => {
                    currentPanel = undefined;
                });
                // handle submit or cancel
                let log;
                currentPanel.webview.onDidReceiveMessage(async message => {
                    switch (message.command) {
                        case "cancel":
                            commands.executeCommand("DoC.viewLogs");
                            break;

                        case "log":
                            if (isLoggedIn()) {
                                log = message.value;
                                // this posts the log create/update to the server as well
                                await addLogToJson(
                                    log.title,
                                    log.description,
                                    log.hours,
                                    log.keystrokes,
                                    log.lines,
                                    log.links
                                );
                                checkLanguageMilestonesAchieved();
                                checkDaysMilestones();
                            } else {
                                displayLoginPromptIfNotLoggedIn();
                            }
                            await syncLogs();
                            commands.executeCommand("DoC.viewLogs");
                            break;
                    }
                });
            }

            currentPanel.webview.html = generatedHtml;
            currentPanel.reveal(ViewColumn.One);
        })
    );

    return Disposable.from(...cmds);
}
