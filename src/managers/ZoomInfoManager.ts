import { ZoomInfo } from "../models/ZoomInfo";
import { window, commands } from "vscode";
import {
    isWindows,
    isValidUrl,
    getFileDataAsJson,
    writeJsonData,
    openFileInEditor,
    getSoftwareDir,
    launchInputBox
} from "../utils/Util";
const fs = require("fs");

export class ZoomInfoManager {
    private static instance: ZoomInfoManager;

    constructor() {}

    static getInstance(): ZoomInfoManager {
        if (!ZoomInfoManager.instance) {
            ZoomInfoManager.instance = new ZoomInfoManager();
        }

        return ZoomInfoManager.instance;
    }

    removeZoomInfo(label: string) {
        const file = this.getZoomInfoFile();
        let existingData: ZoomInfo[] = getFileDataAsJson(file);
        if (!existingData) {
            return;
        }
        const idx = existingData.findIndex((n: ZoomInfo) => n.topic === label);
        if (idx !== -1) {
            // remove the item
            existingData.splice(idx, 1);

            // save it
            writeJsonData(existingData, file);
        } else {
            window.showErrorMessage(
                `Unable to find zoom name '${label}' to delete`
            );
        }

        commands.executeCommand("zoomtime.refreshTree");
    }

    editZoomInfoFile() {
        const file = this.getZoomInfoFile();
        if (!fs.existsSync(file)) {
            // create it
            const data: any[] = [];
            writeJsonData(data, file);
        }
        // open the json document in the editor
        openFileInEditor(this.getZoomInfoFile());
    }

    async initiateAddZoomInfoFlow() {
        // link prompt
        const zoomLink = await this.promptForLink();
        if (!zoomLink) {
            return;
        }

        // name prompt
        const zoomName = await this.promptForTopic();
        if (!zoomName) {
            return;
        }

        // add it
        const zoomInfo: ZoomInfo = new ZoomInfo();
        zoomInfo.join_url = zoomLink.trim();
        zoomInfo.topic = zoomName.trim();
        this.addZoomInfo(zoomInfo);
    }

    private async promptForTopic() {
        return await launchInputBox(
            "Assign a topic to the meeting",
            "Please enter a non-empty topic to continue."
        );
    }

    private async promptForLink() {
        return await launchInputBox(
            "Enter a Zoom link",
            "Please enter a valid and non-empty link to continue.",
            true
        );
    }

    getZoomInfoFile() {
        let file = getSoftwareDir();
        if (isWindows()) {
            file += "\\zoomInfo.json";
        } else {
            file += "/zoomInfo.json";
        }
        return file;
    }

    getZoomInfoList(): ZoomInfo[] {
        const file = this.getZoomInfoFile();
        let existingData: ZoomInfo[] = getFileDataAsJson(file);
        if (!existingData) {
            return [];
        }
        return existingData;
    }

    addZoomInfo(info: ZoomInfo) {
        const file = this.getZoomInfoFile();

        // get the current data (array based)
        let existingData: ZoomInfo[] = getFileDataAsJson(file);

        if (!existingData) {
            existingData = [];
        }

        // check to make suer the link doesn't already exist
        if (Object.keys(existingData).length) {
            const linkExists = existingData.find(
                (n: ZoomInfo) => n.topic === info.topic
            );
            if (linkExists) {
                window.showErrorMessage("Meeting name already exists");
                return;
            }
        }

        // it doesn't exist, add it
        existingData.push(info);

        // save it
        writeJsonData(existingData, file);

        commands.executeCommand("zoomtime.refreshBookmarkTree");
    }
}
