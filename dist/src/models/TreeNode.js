"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TreeNode = void 0;
const vscode_1 = require("vscode");
class TreeNode {
    constructor() {
        this.id = "";
        this.label = "";
        this.value = null;
        this.description = "";
        this.tooltip = "";
        this.command = "";
        this.commandArgs = [];
        this.type = "";
        this.contextValue = "";
        this.callback = null;
        this.icon = "";
        this.children = [];
        this.initialCollapsibleState = vscode_1.TreeItemCollapsibleState.Collapsed;
        this.element_name = "";
    }
}
exports.TreeNode = TreeNode;
//# sourceMappingURL=TreeNode.js.map