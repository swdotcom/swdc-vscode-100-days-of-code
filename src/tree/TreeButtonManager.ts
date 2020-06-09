import { TreeNode } from "../models/TreeNode";

export function getActionButton(
    label: string,
    tooltip: string,
    command: string,
    icon: any = null,
    eventDescription: string = ""
): TreeNode {
    const item: TreeNode = new TreeNode();
    item.tooltip = tooltip;
    item.label = label;
    item.id = label;
    item.command = command;
    item.icon = icon;
    item.contextValue = "action_button";
    item.eventDescription = eventDescription;
    return item;
}

// export function getSubmitFeedbackButton() {
//     return getActionButton(
//         "Submit feedback",
//         "Send us an email at cody@software.com",
//         "zoomtime.sendFeedback",
//         "message.svg"
//     );
// }

export function getDoCLearnMoreButton() {
    return getActionButton(
        "Learn more",
        "View the Code Time Readme to learn more",
        "DoC.ViewReadme",
        "learn-more.svg"
    );
}

export function getDoCToggleStatusBar() {
    return getActionButton(
        "Hide status bar metrics",
        "Hide status bar metrics",
        "DoC.ToggleStatusbar",
        "visible.svg"
    );
}

// export function getLaunchSoftwareWebButton() {
//     return getActionButton(
//         "Launch Software.com",
//         "Opens software.com in browser",
//         "DoC.LaunchSoftwareWebsite",
//         "sw-paw-circle.svg"
//     );
// }

export function getDoCBlankBlueLine() {
    return getActionButton(
        " ",
        " ",
        "",
        "blue-line-96.png"
    );
}

export function getDoCLogDailyProgressButton() {
    return getActionButton(
        "Log Daily Progress",
        "Log Daily Progress",
        "DoC.addLog",
        "log-progress.svg"
    );
}

export function getDashboardButton(){
    return getActionButton(
        "Dashboard",
        "View Dashboard",
        "DoC.viewDashboard",
        "dashboard.svg"
    ); 
}

export function getDoCLogsButon() {
    return getActionButton(
        "Logs",
        "View your log entries",
        "DoC.viewLogs",
        "logs.svg"
    );
}

export function getDocMilestonesButton() {
    return getActionButton(
        "Milestones",
        "View your milestones",
        "DoC.viewMilestones",
        "milestones.svg"
    );
}

export function getDocIdeasButton() {
    return getActionButton(
        "Ideas",
        "Get ideas for 100DoC",
        "DoC.viewIdeas",
        "ideas.svg"
    );
}




