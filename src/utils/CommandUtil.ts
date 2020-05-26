import { Disposable, commands, window, TreeView } from "vscode";
import { TreeNode } from "../models/TreeNode";
import { ZoomInfoManager } from "../managers/ZoomInfoManager";
import { DocListenManager } from "../managers/DocListenManager";
import { launchUrl, displayReadmeIfNotExists, connectZoom } from "./Util";
import { ZoomMeetingManager } from "../managers/ZoomMeetingManager";
import { Tree100DoCProvider, connectDoCTreeView } from "../tree/Tree100DoCProvider";
const clipboardy = require("clipboardy");

export function createCommands(): { dispose: () => void } {
    let cmds: any[] = [];

    const Doc100SftwProvider = new Tree100DoCProvider();
    const Doc100SftwTreeView: TreeView<TreeNode> = window.createTreeView(
        "100DoC-tree",
        {
            treeDataProvider: Doc100SftwProvider,
            showCollapseAll: true
        }
    );
    Doc100SftwProvider.bindView(Doc100SftwTreeView);
    cmds.push(connectDoCTreeView(Doc100SftwTreeView));

    // CONNECT CMD
    cmds.push(
        commands.registerCommand("zoomtime.connectZoom", () => {
            connectZoom();
        })
    );

    // // REVEAL TREE CMD
    // cmds.push(
    //     commands.registerCommand("zoomtime.displayTree", () => {
    //         menuProvider.revealTree();
    //     })
    // );

    // INIT THE DOCUMENT LISTENER
    DocListenManager.getInstance();

    // ADD BOOKMARK CMD
    cmds.push(
        commands.registerCommand("zoomtime.addZoomLink", () => {
            ZoomInfoManager.getInstance().initiateAddZoomInfoFlow();
        })
    );

    // ADD MEETING CMD
    cmds.push(
        commands.registerCommand("zoomtime.createZoomMeeting", () => {
            ZoomMeetingManager.getInstance().initiateCreateMeetingFlow();
        })
    );

    cmds.push(
        commands.registerCommand("zoomtime.copyZoomLink", (node: TreeNode) => {
            // copy into memory
            clipboardy.writeSync(node.value);
        })
    );

    // REMOVE CMD
    cmds.push(
        commands.registerCommand(
            "zoomtime.removeZoomLink",
            (item: TreeNode) => {
                ZoomInfoManager.getInstance().removeZoomInfo(item.label);
            }
        )
    );

    // EDIT CMD
    cmds.push(
        commands.registerCommand("zoomtime.editZoomLink", (item: TreeNode) => {
            ZoomInfoManager.getInstance().editZoomInfoFile();
        })
    );

    // SUBMIT FEEDBACK CMD
    cmds.push(
        commands.registerCommand("zoomtime.sendFeedback", () => {
            launchUrl("mailto:cody@software.com", false);
            commands.executeCommand("zoomtime.refreshTree");
        })
    );

    // LEARN MORE CMD
    cmds.push(
        commands.registerCommand("zoomtime.displayReadme", () => {
            displayReadmeIfNotExists(true /*override*/);
            commands.executeCommand("zoomtime.refreshTree");
        })
    );

    // MANAGE BOOKMARKS CMD
    cmds.push(
        commands.registerCommand("zoomtime.manageBookmarks", () => {
            ZoomInfoManager.getInstance().editZoomInfoFile();
            commands.executeCommand("zoomtime.refreshTree");
        })
    );

    // LAUNCH WEBSITE CMD
    cmds.push(
        commands.registerCommand("DoC.LaunchSoftwareWebsite", () => {
            launchUrl("software.com");
        })
    );

    // LAUNCH LEARN MORE PAGE

    // LAUNCH GOALS PAGE
    // cmds.push(
    //     commands.registerCommand("DoC.goalsCMD", () => {
    //         vscode.window.showInformationMessage("Goals Page");
    //     })
    // )

    // // LAUNCH ADD DIARY PAGE
    // cmds.push(
    //     commands.registerCommand("DoC.goalsCMD", () => {
    //         vscode.window.showInformationMessage("Goals Page");
    //     })
    // )

    // LAUNCH VIEW DIARY PAGE

    // LAUNCH VIEW MILESTONE PAGE

    return Disposable.from(...cmds);
}
