import { getSoftwareDir, isWindows } from "./Util";
import fs = require("fs");

function getSessionSummaryJson() {
    let file = getSoftwareDir();
    if (isWindows()) {
        file += "\\sessionSummary.json";
    } else {
        file += "/sessionSummary.json";
    }
    return file;
}

export function getSessionCodetimeMetrics(): Array<number> {
    const sessionSummaryFile = getSessionSummaryJson();

    // try to get codetime metrics from session summary file
    let codeTimeMetricsStr: string;
    try {
        // retries help when a user downloads Code Time with 100 Days of Code
        // they allow the file to be created and not throw errors
        let exists = false;
        let retries = 5;
        while (retries > 0 && !exists) {
            exists = fs.existsSync(sessionSummaryFile);
            retries--;
        }
        if (exists) {
            codeTimeMetricsStr = fs.readFileSync(sessionSummaryFile).toString();
        } else {
            return [0, 0, 0];
        }
    } catch (err) {
        console.log(err);
        return [0, 0, 0];
    }

    // reading code time metrics from the string
    const metrics = JSON.parse(codeTimeMetricsStr);
    let minutes: number = 0;
    let keystrokes: number = 0;
    let linesAdded: number = 0;

    // checks for avoiding null and undefined
    if (metrics.currentDayMinutes) {
        minutes = metrics.currentDayMinutes;
    }
    if (metrics.currentDayKeystrokes) {
        keystrokes = metrics.currentDayKeystrokes;
    }
    if (metrics.currentDayLinesAdded) {
        linesAdded = metrics.currentDayLinesAdded;
    }

    return [minutes, keystrokes, linesAdded];
}
