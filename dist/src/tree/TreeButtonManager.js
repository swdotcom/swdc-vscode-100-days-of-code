"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDocMilestonesButton = exports.getDoCLogsButon = exports.getDashboardButton = exports.getDoCLearnMoreButton = exports.getActionButton = void 0;
const TreeNode_1 = require("../models/TreeNode");
function getActionButton(label, tooltip, command, icon = null, element_name = "") {
    const item = new TreeNode_1.TreeNode();
    item.tooltip = tooltip;
    item.label = label;
    item.id = label;
    item.command = command;
    item.icon = icon;
    item.contextValue = "action_button";
    item.element_name = element_name;
    return item;
}
exports.getActionButton = getActionButton;
function getDoCLearnMoreButton() {
    return getActionButton("Learn more", "View 100 Days of Code Readme to learn more", "DoC.ViewReadme", "learn-more.svg", "100doc_learn_more_btn");
}
exports.getDoCLearnMoreButton = getDoCLearnMoreButton;
function getDashboardButton() {
    return getActionButton("View dashboard", "View 100 Days of Code dashboard", "DoC.viewDashboard", "dashboard.svg", "100doc_dashboard_btn");
}
exports.getDashboardButton = getDashboardButton;
function getDoCLogsButon() {
    return getActionButton("View logs", "View 100 Days of Code log entries", "DoC.viewLogs", "logs.svg", "100doc_logs_btn");
}
exports.getDoCLogsButon = getDoCLogsButon;
function getDocMilestonesButton() {
    return getActionButton("View milestones", "View 100 Days of Code milestones", "DoC.viewMilestones", "milestones.svg", "100doc_milestones_btn");
}
exports.getDocMilestonesButton = getDocMilestonesButton;
//# sourceMappingURL=TreeButtonManager.js.map