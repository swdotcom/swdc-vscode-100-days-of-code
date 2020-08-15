import { TreeNode } from "../models/TreeNode";

export function getActionButton(
    label: string,
    tooltip: string,
    command: string,
    icon: any = null,
    element_name: string = ""
): TreeNode {
    const item: TreeNode = new TreeNode();
    item.tooltip = tooltip;
    item.label = label;
    item.id = label;
    item.command = command;
    item.icon = icon;
    item.contextValue = "action_button";
    item.element_name = element_name;
    return item;
}

export function getDoCLearnMoreButton() {
    return getActionButton(
        "Learn more",
        "View 100 Days of Code Readme to learn more",
        "DoC.ViewReadme",
        "learn-more.svg",
        "100doc_learn_more_btn"
    );
}

export function getDashboardButton() {
    return getActionButton(
        "View dashboard",
        "View 100 Days of Code dashboard",
        "DoC.viewDashboard",
        "dashboard.svg",
        "100doc_dashboard_btn"
    );
}

export function getDoCLogsButon() {
    return getActionButton(
        "View logs",
        "View 100 Days of Code log entries",
        "DoC.viewLogs",
        "logs.svg",
        "100doc_logs_btn"
    );
}

export function getDocMilestonesButton() {
    return getActionButton(
        "View milestones",
        "View 100 Days of Code milestones",
        "DoC.viewMilestones",
        "milestones.svg",
        "100doc_milestones_btn"
    );
}
