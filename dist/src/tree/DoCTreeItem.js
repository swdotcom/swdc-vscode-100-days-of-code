"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DoCTreeItem = void 0;
const vscode_1 = require("vscode");
const path = require("path");
const resourcePath = path.join(__dirname, "resources");
class DoCTreeItem extends vscode_1.TreeItem {
    constructor(treeItem, collapsibleState, command) {
        super(treeItem.label, collapsibleState);
        this.treeItem = treeItem;
        this.collapsibleState = collapsibleState;
        this.command = command;
        this.iconPath = {
            light: "",
            dark: ""
        };
        this.contextValue = "treeItem";
        // get the description (sub label)
        this.description = treeItem.description;
        // get the icons
        const { lightPath, darkPath } = getTreeItemIcon(treeItem);
        if (lightPath && darkPath) {
            this.iconPath.light = lightPath;
            this.iconPath.dark = darkPath;
        }
        else {
            // no icon found, delete it
            delete this.iconPath;
        }
        // set the context value (used in the config to match for icon hovering)
        this.contextValue = getTreeItemContextValue(treeItem);
    }
}
exports.DoCTreeItem = DoCTreeItem;
function getTreeItemIcon(treeItem) {
    const iconName = treeItem.icon;
    const lightPath = iconName && treeItem.children.length === 0 ? path.join(resourcePath, "light", iconName) : null;
    const darkPath = iconName && treeItem.children.length === 0 ? path.join(resourcePath, "dark", iconName) : null;
    return { lightPath, darkPath };
}
function getTreeItemContextValue(treeItem) {
    if (treeItem.contextValue) {
        return treeItem.contextValue;
    }
    if (treeItem.children.length) {
        return "parent";
    }
    return "child";
}
//# sourceMappingURL=DoCTreeItem.js.map