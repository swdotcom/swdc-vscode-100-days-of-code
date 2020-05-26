import { workspace, Disposable, commands } from "vscode";
import { ZoomInfoManager } from "./ZoomInfoManager";

export class DocListenManager {
    private static instance: DocListenManager;

    private _disposable: Disposable;
    private zoomInfoFile: string = "";

    static getInstance(): DocListenManager {
        if (!DocListenManager.instance) {
            DocListenManager.instance = new DocListenManager();
        }

        return DocListenManager.instance;
    }

    constructor() {
        this.zoomInfoFile = ZoomInfoManager.getInstance().getZoomInfoFile();
        let subscriptions: Disposable[] = [];
        // listen to save events
        workspace.onDidSaveTextDocument(this.onSaveHandler, this);
        this._disposable = Disposable.from(...subscriptions);
    }

    private async onSaveHandler(event: any) {
        const filename = this.getFileName(event);
        if (filename && filename === this.zoomInfoFile) {
            // file matches the zoom info file, refresh the tree
            commands.executeCommand("zoomtime.refreshTree");
        }
    }

    private getFileName(event: any) {
        let filename = "";
        if (event.fileName) {
            filename = event.fileName;
        } else if (event.document && event.document.fileName) {
            filename = event.document.fileName;
        }
        return filename;
    }

    public dispose() {
        this._disposable.dispose();
    }
}
