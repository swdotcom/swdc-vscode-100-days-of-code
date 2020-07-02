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

export function getDoCLearnMoreButton() {
    return getActionButton("Learn more", "View the Code Time Readme to learn more", "DoC.ViewReadme", "learn-more.svg");
}

export function getDashboardButton() {
    return getActionButton("View Dashboard", "View Dashboard", "DoC.viewDashboard", "dashboard.svg");
}

export function getDoCLogsButon() {
    return getActionButton("View Logs", "View your log entries", "DoC.viewLogs", "logs.svg");
}

export function getDocMilestonesButton() {
    return getActionButton("View Milestones", "View your milestones", "DoC.viewMilestones", "milestones.svg");
}
