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
import { current_round, checkSummaryJson, switchRound } from "./SummaryUtil";

export function createCommands(): { dispose: () => void } {
    let cmds: any[] = [];
    let currentPanel: WebviewPanel | undefined = undefined;

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
            if (currentPanel) {
                if (currentPanel.title !== "Logs") {
                    currentPanel.dispose();
                    commands.executeCommand("DoC.viewLogs");
                } else {
                    // have to implement this check for worst case scenario
                    if (currentPanel) {
                        currentPanel.webview.html = getUpdatedLogsHtml();
                    }

                    currentPanel.reveal(ViewColumn.One);
                }
            } else {
                currentPanel = window.createWebviewPanel("Logs", "Logs", ViewColumn.One, {
                    enableScripts: true
                });

                if (currentPanel) {
                    currentPanel.webview.html = getUpdatedLogsHtml();
                    displayLoginPromptIfNotLoggedIn();
                }

                const logInterval = setInterval(() => {
                    // updates only in the background
                    if (currentPanel && !currentPanel.active) {
                        // updateLogsHtml();
                        // have to implement this check for worst case scenario
                        if (currentPanel) {
                            currentPanel.webview.html = getUpdatedLogsHtml();
                        }
                    }
                }, 60000);

                currentPanel.webview.onDidReceiveMessage(message => {
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
                            break;
                        case "addLog":
                            if (currentPanel && isLoggedIn()) {
                                currentPanel.dispose();
                                commands.executeCommand("DoC.addLog");
                            } else if (!isLoggedIn()) {
                                displayLoginPromptIfNotLoggedIn();
                            }
                            break;
                        case "incrementShare":
                            updateLogShare(message.value);
                            checkSharesMilestones();
                            break;
                    }
                });

                currentPanel.onDidDispose(() => {
                    clearInterval(logInterval);
                    currentPanel = undefined;
                });
            }
        })
    );

    cmds.push(
        commands.registerCommand("DoC.viewDashboard", () => {
            if (currentPanel) {
                if (currentPanel.title !== "Dashboard") {
                    currentPanel.dispose();
                    commands.executeCommand("DoC.viewDashboard");
                } else {
                    if (currentPanel) {
                        currentPanel.webview.html = getUpdatedDashboardHtmlString();
                    }
                    currentPanel.reveal(ViewColumn.One);
                }
            } else {
                currentPanel = window.createWebviewPanel("Dashboard", "Dashboard", ViewColumn.One, {
                    enableScripts: true
                });

                if (currentPanel) {
                    currentPanel.webview.html = getUpdatedDashboardHtmlString();
                    displayLoginPromptIfNotLoggedIn();
                }

                const dashboardInterval = setInterval(() => {
                    if (currentPanel) {
                        currentPanel.webview.html = getUpdatedDashboardHtmlString();
                    }
                }, 60000);

                currentPanel.webview.onDidReceiveMessage(message => {
                    switch (message.command) {
                        case "Logs":
                            if (currentPanel) {
                                currentPanel.dispose();
                                commands.executeCommand("DoC.viewLogs");
                            }
                            break;
                        case "Milestones":
                            if (currentPanel) {
                                currentPanel.dispose();
                                commands.executeCommand("DoC.viewMilestones");
                            }
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

                currentPanel.onDidDispose(() => {
                    clearInterval(dashboardInterval);
                    currentPanel = undefined;
                });
            }
        })
    );

    cmds.push(
        commands.registerCommand("DoC.viewMilestones", () => {
            if (isLoggedIn()) {
                checkCodeTimeMetricsMilestonesAchieved();
                checkLanguageMilestonesAchieved();
                checkDaysMilestones();
            }

            if (currentPanel) {
                if (currentPanel.title !== "Milestones") {
                    currentPanel.dispose();
                    commands.executeCommand("DoC.viewMilestones");
                } else {
                    // have to implement this check for worst case scenario
                    if (currentPanel) {
                        currentPanel.webview.html = getUpdatedMilestonesHtmlString();
                    }
                    currentPanel.reveal(ViewColumn.One);
                }
            } else {
                currentPanel = window.createWebviewPanel("Milestones", "Milestones", ViewColumn.One, {
                    enableScripts: true
                });

                // have to implement this check for worst case scenario
                if (currentPanel) {
                    currentPanel.webview.html = getUpdatedMilestonesHtmlString();
                    displayLoginPromptIfNotLoggedIn();
                }

                const milestoneInterval = setInterval(() => {
                    // have to implement this check for worst case scenario
                    if (currentPanel) {
                        currentPanel.webview.html = getUpdatedMilestonesHtmlString();
                    }
                }, 60000);

                currentPanel.webview.onDidReceiveMessage(message => {
                    switch (message.command) {
                        case "incrementShare":
                            updateMilestoneShare(message.value);
                            checkSharesMilestones();
                            break;
                    }
                });

                currentPanel.onDidDispose(() => {
                    clearInterval(milestoneInterval);
                    currentPanel = undefined;
                });
            }
        })
    );

    cmds.push(
        commands.registerCommand("DoC.addLog", () => {
            if (currentPanel) {
                if (currentPanel.title !== "Add Daily Progress Log") {
                    currentPanel.dispose();
                    commands.executeCommand("DoC.addLog");
                } else {
                    // have to implement this check for worst case scenario
                    if (currentPanel) {
                        currentPanel.webview.html = getUpdatedAddLogHtmlString();
                    }

                    currentPanel.reveal(ViewColumn.One);
                }
            } else {
                currentPanel = window.createWebviewPanel(
                    "Add Daily Progress Log",
                    "Add Daily Progress Log",
                    ViewColumn.One,
                    { enableScripts: true }
                );

                if (currentPanel) {
                    currentPanel.webview.html = getUpdatedAddLogHtmlString();
                }

                // handle submit or cancel
                let log;
                currentPanel.webview.onDidReceiveMessage(message => {
                    switch (message.command) {
                        case "cancel":
                            if (currentPanel) {
                                currentPanel.dispose();
                            }
                            commands.executeCommand("DoC.viewLogs");
                            break;

                        case "log":
                            if (currentPanel && isLoggedIn()) {
                                log = message.value;
                                addLogToJson(
                                    log.title,
                                    log.description,
                                    log.hours,
                                    log.keystrokes,
                                    log.lines,
                                    log.links
                                );
                                checkLanguageMilestonesAchieved();
                                checkDaysMilestones();
                                currentPanel.dispose();
                                commands.executeCommand("DoC.viewLogs");
                            } else if (currentPanel) {
                                displayLoginPromptIfNotLoggedIn();
                                currentPanel.dispose();
                                commands.executeCommand("DoC.viewLogs");
                            }
                            break;
                    }
                });

                currentPanel.onDidDispose(() => {
                    currentPanel = undefined;
                });
            }
        })
    );

    cmds.push(
        commands.registerCommand("DoC.startNewRound", () => {
            if (current_round === 0) {
                if (!checkSummaryJson()) {
                    window.showErrorMessage("Cannot access Summary file! Please contact cody@software.com for help.");
                    return;
                } else if (current_round === 0) {
                    return;
                }
            } else {
                window
                    .showInformationMessage(
                        `Are you sure you want to start Round ${current_round + 1} of 100 Days of Code?`,
                        {
                            modal: true
                        },
                        "Yes"
                    )
                    .then(selection => {
                        if (selection === "Yes") {
                            switchRound(current_round + 1);
                            window.showInformationMessage(`Round ${current_round} of 100 Days of Code started!`);
                        }
                    });
            }
        })
    );

    cmds.push(
        commands.registerCommand("DoC.switchRound", () => {
            if (current_round === 0) {
                if (!checkSummaryJson()) {
                    window.showErrorMessage("Cannot access Summary file! Please contact cody@software.com for help.");
                    return;
                } else if (current_round === 0) {
                    return;
                }
            } else {
                window
                    .showInformationMessage(
                        `Are you sure you want to switch from Round ${current_round} of 100 Days of Code?`,
                        {
                            modal: true
                        },
                        "Yes"
                    )
                    .then(selection => {
                        if (selection === "Yes") {
                            window
                                .showInputBox({
                                    prompt: "Please enter a round number",
                                    value: current_round.toString()
                                })
                                .then(text => {
                                    if (text) {
                                        const roundNumber = parseInt(text);
                                        if (roundNumber) {
                                            switchRound(roundNumber);
                                            window.showInformationMessage(
                                                `Switched to Round ${current_round} of 100 Days of Code!`
                                            );
                                        }
                                    }
                                });
                        }
                    });
            }
        })
    );

    return Disposable.from(...cmds);
}
