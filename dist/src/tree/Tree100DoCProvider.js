"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Tree100DoCProvider = exports.connectDoCTreeView = void 0;
const vscode_1 = require("vscode");
const DoCTreeItem_1 = require("./DoCTreeItem");
const TreeButtonManager_1 = require("./TreeButtonManager");
const TrackerManager_1 = require("../managers/TrackerManager");
const docCollapsedStateMap = {};
exports.connectDoCTreeView = (view) => {
    const tracker = TrackerManager_1.TrackerManager.getInstance();
    return vscode_1.Disposable.from(view.onDidCollapseElement((e) => __awaiter(void 0, void 0, void 0, function* () {
        const item = e.element;
        docCollapsedStateMap[item.label] = vscode_1.TreeItemCollapsibleState.Collapsed;
    })), view.onDidExpandElement((e) => __awaiter(void 0, void 0, void 0, function* () {
        const item = e.element;
        docCollapsedStateMap[item.label] = vscode_1.TreeItemCollapsibleState.Expanded;
    })), view.onDidChangeSelection((e) => __awaiter(void 0, void 0, void 0, function* () {
        if (!e.selection || e.selection.length === 0) {
            return;
        }
        const item = e.selection[0];
        tracker.trackUIInteraction("click", item.element_name, "100doc_menu_tree", "", "", item.label);
        if (item.command) {
            const args = item.commandArgs || null;
            if (args) {
                vscode_1.commands.executeCommand(item.command, ...args);
            }
            else {
                // run the command
                vscode_1.commands.executeCommand(item.command);
            }
        }
    })), view.onDidChangeVisibility(e => {
        if (e.visible) {
            //
        }
    }));
};
class Tree100DoCProvider {
    constructor() {
        this._onDidChangeTreeData = new vscode_1.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
        this.initializedTree = false;
        //
    }
    revealTree() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.initializedTree) {
                yield this.refresh();
            }
            setTimeout(() => {
                const learnMoreButton = TreeButtonManager_1.getDoCLearnMoreButton();
                try {
                    if (this.view) {
                        // select the readme item
                        this.view.reveal(learnMoreButton, {
                            focus: true,
                            select: false
                        });
                    }
                }
                catch (err) {
                    console.log(`Unable to select tree item: ${err.message}`);
                }
            }, 1000);
        });
    }
    bindView(docTreeView) {
        this.view = docTreeView;
    }
    getParent(_p) {
        return void 0; // all playlists are in root
    }
    refresh() {
        this._onDidChangeTreeData.fire(undefined);
    }
    refreshParent(parent) {
        this._onDidChangeTreeData.fire(parent);
    }
    getTreeItem(p) {
        let treeItem;
        if (p.children.length) {
            let collapsibleState = docCollapsedStateMap[p.label];
            if (!collapsibleState) {
                treeItem = createDoCTreeItem(p, p.initialCollapsibleState);
            }
            else {
                treeItem = createDoCTreeItem(p, collapsibleState);
            }
        }
        else {
            treeItem = createDoCTreeItem(p, vscode_1.TreeItemCollapsibleState.None);
        }
        return treeItem;
    }
    getChildren(element) {
        return __awaiter(this, void 0, void 0, function* () {
            let nodeItems = [];
            if (element) {
                // return the children of this element
                nodeItems = element.children;
            }
            else {
                // return the parent elements
                nodeItems = yield this.getMenuParents();
            }
            return nodeItems;
        });
    }
    getMenuParents() {
        return __awaiter(this, void 0, void 0, function* () {
            const treeItems = [];
            const feedbackButton = TreeButtonManager_1.getDoCLearnMoreButton();
            treeItems.push(feedbackButton);
            // get the manage bookmarks button
            const dashboardButton = TreeButtonManager_1.getDashboardButton();
            treeItems.push(dashboardButton);
            const logsButton = TreeButtonManager_1.getDoCLogsButon();
            treeItems.push(logsButton);
            const milestoneButton = TreeButtonManager_1.getDocMilestonesButton();
            treeItems.push(milestoneButton);
            return treeItems;
        });
    }
}
exports.Tree100DoCProvider = Tree100DoCProvider;
/**
 * Create the playlist tree item (root or leaf)
 * @param p
 * @param cstate
 */
function createDoCTreeItem(p, cstate) {
    return new DoCTreeItem_1.DoCTreeItem(p, cstate);
}
//# sourceMappingURL=Tree100DoCProvider.js.map