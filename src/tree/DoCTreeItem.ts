import { TreeItem, TreeItemCollapsibleState, Command } from "vscode";
import * as path from "path";
import { TreeNode } from "../models/TreeNode";

const resourcePath: string = path.join(__filename, "..", "..", "..", "resources");

export class DoCTreeItem extends TreeItem {
    constructor(
        private readonly treeItem: TreeNode,
        public readonly collapsibleState: TreeItemCollapsibleState,
        public readonly command?: Command
    ) {
        super(treeItem.label, collapsibleState);

        // get the description (sub label)
        this.description = treeItem.description;

        // get the icons
        const { lightPath, darkPath } = getTreeItemIcon(treeItem);
        if (lightPath && darkPath) {
            this.iconPath.light = lightPath;
            this.iconPath.dark = darkPath;
        } else {
            // no icon found, delete it
            delete this.iconPath;
        }

        // set the context value (used in the config to match for icon hovering)
        this.contextValue = getTreeItemContextValue(treeItem);
    }

    get tooltip(): string {
        if (!this.treeItem) {
            return "";
        }
        if (this.treeItem.tooltip) {
            return this.treeItem.tooltip;
        } else {
            return this.treeItem.label;
        }
    }

    iconPath = {
        light: "",
        dark: ""
    };

    contextValue = "treeItem";
}

function getTreeItemIcon(treeItem: TreeNode): any {
    const iconName = treeItem.icon;
    const lightPath = iconName && treeItem.children.length === 0 ? path.join(resourcePath, "light", iconName) : null;
    const darkPath = iconName && treeItem.children.length === 0 ? path.join(resourcePath, "dark", iconName) : null;
    return { lightPath, darkPath };
}

function getTreeItemContextValue(treeItem: TreeNode): string {
    if (treeItem.contextValue) {
        return treeItem.contextValue;
    }
    if (treeItem.children.length) {
        return "parent";
    }
    return "child";
}
