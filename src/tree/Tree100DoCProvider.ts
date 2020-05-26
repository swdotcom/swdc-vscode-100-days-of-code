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
import { ZoomTreeItem } from "./ZoomTreeItem";
import {
	getLearnMoreButton,
	getDocGoalsButton,
	getDocDiaryAddButton,
	getDocDiaryButton,
	getDocMilestonesButton,
	getBlankBlueLine,
	getDoCToggleStatusBar
} from "./TreeButtonManager";
import { launchUrl, getItem } from "../utils/Util";

const zoomCollapsedStateMap: any = {};

export const connectDoCTreeView = (view: TreeView<TreeNode>) => {
	return Disposable.from(
		view.onDidCollapseElement(async e => {
			const item: TreeNode = e.element;
			zoomCollapsedStateMap[item.label] =
				TreeItemCollapsibleState.Collapsed;
		}),

		view.onDidExpandElement(async e => {
			const item: TreeNode = e.element;
			zoomCollapsedStateMap[item.label] =
				TreeItemCollapsibleState.Expanded;
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
				commands.executeCommand("zoomtime.refreshTree");
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
	private _onDidChangeTreeData: EventEmitter<
		TreeNode | undefined
	> = new EventEmitter<TreeNode | undefined>();

	readonly onDidChangeTreeData: Event<TreeNode | undefined> = this
		._onDidChangeTreeData.event;

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
			const learnMoreButton: TreeNode = getLearnMoreButton();
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

	bindView(zoomTreeView: TreeView<TreeNode>): void {
		this.view = zoomTreeView;
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

	getTreeItem(p: TreeNode): ZoomTreeItem {
		let treeItem: ZoomTreeItem;
		if (p.children.length) {
			let collasibleState = zoomCollapsedStateMap[p.label];
			if (!collasibleState) {
				treeItem = createZoomTreeItem(p, p.initialCollapsibleState);
			} else {
				treeItem = createZoomTreeItem(p, collasibleState);
			}
		} else {
			treeItem = createZoomTreeItem(p, TreeItemCollapsibleState.None);
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

		const feedbackButton: TreeNode = getLearnMoreButton();
		treeItems.push(feedbackButton);

		const blueLineButton: TreeNode = getBlankBlueLine();
		treeItems.push(blueLineButton);

		// get the manage bookmarks button
		const goalsButton: TreeNode = getDocGoalsButton();
		treeItems.push(goalsButton);

		const addDiaryButton: TreeNode = getDocDiaryAddButton();
		treeItems.push(addDiaryButton);

		const diaryButton: TreeNode = getDocDiaryButton();
		treeItems.push(diaryButton);

		const milestoneButton: TreeNode = getDocMilestonesButton();
		treeItems.push(milestoneButton);

		return treeItems;
	}
}

/**
 * Create the playlist tree item (root or leaf)
 * @param p
 * @param cstate
 */
function createZoomTreeItem(p: TreeNode, cstate: TreeItemCollapsibleState) {
	return new ZoomTreeItem(p, cstate);
}
