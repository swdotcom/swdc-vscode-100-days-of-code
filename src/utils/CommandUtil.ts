import { Disposable, commands, window, TreeView, ViewColumn, WebviewPanel } from "vscode";
import { TreeNode } from "../models/TreeNode";
import { Tree100DoCProvider, connectDoCTreeView } from "../tree/Tree100DoCProvider";
import { addLogToJson, editLogEntry, updateLogShare } from "./LogsUtil";
import {
  checkDaysMilestones,
  checkLanguageMilestonesAchieved,
  checkCodeTimeMetricsMilestonesAchieved,
  updateMilestoneShare,
  checkSharesMilestones,
} from "./MilestonesUtil";
import { getAddLogHtmlString } from "./AddLogUtil";
import { getUpdatedDashboardHtmlString, getCertificateHtmlString } from "./DashboardUtil";
import { displayReadmeIfNotExists, displayLoginPromptIfNotLoggedIn, isLoggedIn, checkIfNameChanged } from "./Util";
import { getUpdatedMilestonesHtmlString } from "./MilestonesTemplateUtil";
import { getUpdatedLogsHtml } from "./LogsTemplateUtil";
import { TrackerManager } from "../managers/TrackerManager";
import { deleteLogDay, syncLogs } from "./LogsUtil";
import { MilestoneEventManager } from "../managers/MilestoneEventManager";
import { YES_LABEL } from "./Constants";
import { restartChallenge } from "./SummaryUtil";

let currentTitle: string = "";

export function reloadCurrentView() {
  if (currentTitle) {
    switch (currentTitle) {
      case "Logs":
        commands.executeCommand("DoC.viewLogs");
        break;
      case "Dashboard":
        commands.executeCommand("DoC.viewDashboard");
        break;
      case "Milestones":
        commands.executeCommand("DoC.viewMilestones");
        break;
    }
  }
}

export function createCommands(): { dispose: () => void } {
  let cmds: any[] = [];
  let currentPanel: WebviewPanel | undefined = undefined;

  const Doc100SftwProvider = new Tree100DoCProvider();
  const Doc100SftwTreeView: TreeView<TreeNode> = window.createTreeView("100-days-of-code-view", {
    treeDataProvider: Doc100SftwProvider,
    showCollapseAll: true,
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
    commands.registerCommand("DoC.viewLogs", async () => {
      // check if the user has changed accounts
      await checkIfNameChanged();

      const generatedHtml = getUpdatedLogsHtml();

      const title = "Logs";
      if (currentPanel && title !== currentTitle) {
        // dipose the previous one
        currentPanel.dispose();
      }
      currentTitle = title;

      if (!currentPanel) {
        currentPanel = window.createWebviewPanel("100doc", title, ViewColumn.One, { enableScripts: true });
        currentPanel.onDidDispose(() => {
          currentPanel = undefined;
        });
        currentPanel.webview.onDidReceiveMessage(async (message) => {
          if (!isLoggedIn()) {
            displayLoginPromptIfNotLoggedIn();
          }

          switch (message.command) {
            case "editLog":
              const dayUpdate = message.value;

              await editLogEntry(
                parseInt(dayUpdate.day_number, 10),
                parseInt(dayUpdate.unix_date, 10),
                dayUpdate.title,
                dayUpdate.description,
                dayUpdate.links,
                dayUpdate.hours
              );

              await syncLogs();
              commands.executeCommand("DoC.viewLogs");
              break;
            case "addLog":
              TrackerManager.getInstance().trackUIInteraction("click", "100doc_add_log_btn", "100doc_logs_view", "blue", "", "Add Log");

              commands.executeCommand("DoC.addLog");
              break;
            case "incrementShare":
              TrackerManager.getInstance().trackUIInteraction("click", "100doc_share_log_btn", "100doc_logs_view", "", "share", "");
              updateLogShare(message.value);
              checkSharesMilestones();
              break;
            case "deleteLog":
              const selection = await window.showInformationMessage(
                `Are you sure you want to delete this log, '${message.value.title}'?`,
                { modal: true },
                ...["Yes"]
              );

              if (selection && selection === "Yes") {
                commands.executeCommand("DoC.deleteLog", message.value.unix_date);
              }
              break;
            case "refreshView":
              // refresh the logs then show it again
              await syncLogs();
              if (currentPanel) {
                // dipose the previous one
                currentPanel.dispose();
              }
              commands.executeCommand("DoC.viewLogs");
              break;
            case "logInToAccount":
              commands.executeCommand("codetime.codeTimeExisting");
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
    commands.registerCommand("DoC.viewDashboard", async () => {
      // check if the user has changed accounts
      await checkIfNameChanged();

      const generatedHtml = getUpdatedDashboardHtmlString();

      const title = "Dashboard";
      if (currentPanel && title !== currentTitle) {
        // dipose the previous one
        currentPanel.dispose();
      }
      currentTitle = title;

      if (!currentPanel) {
        currentPanel = window.createWebviewPanel("100doc", title, ViewColumn.One, { enableScripts: true });
        currentPanel.onDidDispose(() => {
          currentPanel = undefined;
        });

        currentPanel.webview.onDidReceiveMessage(async (message) => {
          switch (message.command) {
            case "Logs":
              commands.executeCommand("DoC.viewLogs");
              TrackerManager.getInstance().trackUIInteraction("click", "100doc_logs_btn", "100doc_dashboard_view", "", "", "View Logs");
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
              TrackerManager.getInstance().trackUIInteraction("click", "100doc_milestones_btn", "100doc_dashboard_view", "", "", "View Milestones");
              break;
            case "Certificate":
              window
                .showInputBox({
                  placeHolder: "Your name",
                  prompt: "Please enter your name for getting the certificate. Please make sure that you are connected to the internet.",
                })
                .then((text) => {
                  if (text) {
                    const panel = window.createWebviewPanel("Congratulations!", "Congratulations!", ViewColumn.One);
                    panel.webview.html = getCertificateHtmlString(text);
                    panel.reveal(ViewColumn.One);
                  }
                });
            case "refreshView":
              // refresh the logs then show it again
              if (currentPanel) {
                // dipose the previous one
                currentPanel.dispose();
              }
              commands.executeCommand("DoC.viewDashboard");
              break;
            case "logInToAccount":
              commands.executeCommand("codetime.codeTimeExisting");
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
    commands.registerCommand("DoC.viewMilestones", async () => {
      // check if the user has changed accounts
      await checkIfNameChanged();

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
      currentTitle = title;

      if (!currentPanel) {
        currentPanel = window.createWebviewPanel("100doc", title, ViewColumn.One, { enableScripts: true });
        currentPanel.onDidDispose(() => {
          currentPanel = undefined;
        });

        currentPanel.webview.onDidReceiveMessage(async (message) => {
          switch (message.command) {
            case "incrementShare":
              TrackerManager.getInstance().trackUIInteraction("click", "100doc_share_milestone_btn", "100doc_milestones_view", "", "share", "");
              updateMilestoneShare(message.value);
              checkSharesMilestones();
              break;
            case "refreshView":
              // refresh the milestones
              await MilestoneEventManager.getInstance().fetchAllMilestones();
              if (currentPanel) {
                // dipose the previous one
                currentPanel.dispose();
              }
              commands.executeCommand("DoC.viewMilestones");
              break;
            case "logInToAccount":
              commands.executeCommand("codetime.codeTimeExisting");
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
      const generatedHtml = getAddLogHtmlString();

      const title = "Add Daily Progress Log";
      if (currentPanel && title !== currentTitle) {
        // dipose the previous one
        currentPanel.dispose();
      }
      currentTitle = title;

      if (!currentPanel) {
        currentPanel = window.createWebviewPanel("100doc", title, ViewColumn.One, { enableScripts: true });
        currentPanel.onDidDispose(() => {
          currentPanel = undefined;
        });
        // handle submit or cancel
        let log;
        currentPanel.webview.onDidReceiveMessage(async (message) => {
          switch (message.command) {
            // no need to add a cancel, just show the logs as a default
            case "log":
              if (isLoggedIn()) {
                log = message.value;
                // this posts the log create/update to the server as well
                await addLogToJson(log.title, log.description, log.hours, log.keystrokes, log.lines, log.links);
                checkLanguageMilestonesAchieved();
                checkDaysMilestones();
                await syncLogs();
              } else {
                displayLoginPromptIfNotLoggedIn();
              }
              break;
            case "logInToAccount":
              commands.executeCommand("codetime.codeTimeExisting");
              break;
          }
          commands.executeCommand("DoC.viewLogs");
        });
      }

      currentPanel.webview.html = generatedHtml;
      currentPanel.reveal(ViewColumn.One);
    })
  );

  cmds.push(
    commands.registerCommand("DoC.showInfoMessage", (tile: string, message: string, isModal: boolean, commandCallback: string) => {
      window
        .showInformationMessage(
          message,
          {
            modal: isModal,
          },
          tile
        )
        .then((selection) => {
          if (commandCallback && selection === tile) {
            commands.executeCommand(commandCallback);
          }
        });
    })
  );

  cmds.push(
    commands.registerCommand("DoC.restartChallengeRound", () => {
      if (!isLoggedIn()) {
        displayLoginPromptIfNotLoggedIn();
        return;
      }
      window
        .showInformationMessage(
          "Are you sure you want to restart the challenge? Once your challenge is restarted, you will not see your stats from your previous challenge.",
          {
            modal: true,
          },
          YES_LABEL
        )
        .then((selection) => {
          if (selection === YES_LABEL) {
            // set the new challenge round and create a new log based on the new round val
            restartChallenge();
          }
        });
    })
  );

  return Disposable.from(...cmds);
}
