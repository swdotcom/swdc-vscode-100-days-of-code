import { TreeItemCollapsibleState } from "vscode";

export class TreeNode {
    public id: string = "";
    public label: string = "";
    public value: any = null;
    public description: string = "";
    public tooltip: string = "";
    public command: string = "";
    public commandArgs: any[] = [];
    public type: string = "";
    public contextValue: string = "";
    public callback: any = null;
    public icon: string = "";
    public children: TreeNode[] = [];
    public eventDescription: string = "";
    public initialCollapsibleState: TreeItemCollapsibleState = TreeItemCollapsibleState.Collapsed;
}
