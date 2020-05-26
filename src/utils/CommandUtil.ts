import { Disposable, commands, window, TreeView } from "vscode";
import { TreeNode } from "../models/TreeNode";
import { Tree100DoCProvider, connectDoCTreeView } from "../tree/Tree100DoCProvider";

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

    // LAUNCH LEARN MORE PAGE

    // // LAUNCH GOALS PAGE
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
