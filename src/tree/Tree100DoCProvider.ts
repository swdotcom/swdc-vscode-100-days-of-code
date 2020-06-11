import {
    TreeDataProvider,
    TreeItemCollapsibleState,
    EventEmitter,
    Event,
    Disposable,
    TreeView,
    commands
} from "vscode";
import { TreeNode } from "../models/TreeNode";
import { DoCTreeItem } from "./DoCTreeItem";
import {
    getDoCLearnMoreButton,
    getDocMilestonesButton,
    getDoCBlankBlueLine,
    getDoCToggleStatusBar,
    getDoCLogDailyProgressButton,
    getDoCLogsButon,
    getDashboardButton,
    getDocIdeasButton
} from "./TreeButtonManager";
import { launchUrl } from "../utils/Util";

const docCollapsedStateMap: any = {};

export const connectDoCTreeView = (view: TreeView<TreeNode>) => {
    return Disposable.from(
        view.onDidCollapseElement(async e => {
            const item: TreeNode = e.element;
            docCollapsedStateMap[item.label] = TreeItemCollapsibleState.Collapsed;
        }),

        view.onDidExpandElement(async e => {
            const item: TreeNode = e.element;
            docCollapsedStateMap[item.label] = TreeItemCollapsibleState.Expanded;
        }),

        view.onDidChangeSelection(async e => {
            if (!e.selection || e.selection.length === 0) {
                return;
            }

            const item: TreeNode = e.selection[0];
            if (item.command) {
                const args = item.commandArgs || null;
                if (args) {
                    commands.executeCommand(item.command, ...args);
                } else {
                    // run the command
                    commands.executeCommand(item.command);
                }
            } else if (item.value) {
                launchUrl(item.value);
                commands.executeCommand("doctime.refreshTree");
            }
        }),

        view.onDidChangeVisibility(e => {
            if (e.visible) {
                //
            }
        })
    );
};

export class Tree100DoCProvider implements TreeDataProvider<TreeNode> {
    private _onDidChangeTreeData: EventEmitter<TreeNode | undefined> = new EventEmitter<TreeNode | undefined>();

    readonly onDidChangeTreeData: Event<TreeNode | undefined> = this._onDidChangeTreeData.event;

    private view: TreeView<TreeNode> | undefined;
    private initializedTree: boolean = false;

    constructor() {
        //
    }

    async revealTree() {
        if (!this.initializedTree) {
            await this.refresh();
        }

        setTimeout(() => {
            const learnMoreButton: TreeNode = getDoCLearnMoreButton();
            try {
                if (this.view) {
                    // select the readme item
                    this.view.reveal(learnMoreButton, {
                        focus: true,
                        select: false
                    });
                }
            } catch (err) {
                console.log(`Unable to select tree item: ${err.message}`);
            }
        }, 1000);
    }

    bindView(docTreeView: TreeView<TreeNode>): void {
        this.view = docTreeView;
    }

    getParent(_p: TreeNode) {
        return void 0; // all playlists are in root
    }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    refreshParent(parent: TreeNode) {
        this._onDidChangeTreeData.fire(parent);
    }

    getTreeItem(p: TreeNode): DoCTreeItem {
        let treeItem: DoCTreeItem;
        if (p.children.length) {
            let collasibleState = docCollapsedStateMap[p.label];
            if (!collasibleState) {
                treeItem = createDoCTreeItem(p, p.initialCollapsibleState);
            } else {
                treeItem = createDoCTreeItem(p, collasibleState);
            }
        } else {
            treeItem = createDoCTreeItem(p, TreeItemCollapsibleState.None);
        }

        return treeItem;
    }

    async getChildren(element?: TreeNode): Promise<TreeNode[]> {
        let nodeItems: TreeNode[] = [];

        if (element) {
            // return the children of this element
            nodeItems = element.children;
        } else {
            // return the parent elements
            nodeItems = await this.getMenuParents();
        }
        return nodeItems;
    }

    async getMenuParents(): Promise<TreeNode[]> {
        const treeItems: TreeNode[] = [];

        const toggleStatusBar: TreeNode = getDoCToggleStatusBar();
        treeItems.push(toggleStatusBar);

        const feedbackButton: TreeNode = getDoCLearnMoreButton();
        treeItems.push(feedbackButton);

        const blueLineButton: TreeNode = getDoCBlankBlueLine();
        treeItems.push(blueLineButton);

        // get the manage bookmarks button

        const addLogsButton: TreeNode = getDoCLogDailyProgressButton();
        treeItems.push(addLogsButton);

        const dashboardButton: TreeNode = getDashboardButton();
        treeItems.push(dashboardButton);

        const logsButton: TreeNode = getDoCLogsButon();
        treeItems.push(logsButton);

        const milestoneButton: TreeNode = getDocMilestonesButton();
        treeItems.push(milestoneButton);

        const ideasButton: TreeNode = getDocIdeasButton();
        treeItems.push(ideasButton);

        return treeItems;
    }
}

/**
 * Create the playlist tree item (root or leaf)
 * @param p
 * @param cstate
 */
function createDoCTreeItem(p: TreeNode, cstate: TreeItemCollapsibleState) {
    return new DoCTreeItem(p, cstate);
}
