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

export function getSessionCodetimeMetrics(): any {
    const sessionSummaryFile = getSessionSummaryJson();

    let metricsOut = {
        minutes: 0,
        keystrokes: 0,
        linesAdded: 0

    };

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
            return metricsOut;
        }
    } catch (err) {
        console.log(err);
        return metricsOut;
    }

    // reading code time metrics from the string
    const metrics = JSON.parse(codeTimeMetricsStr);

    // checks for avoiding null and undefined
    if (metrics.currentDayMinutes) {
        metricsOut.minutes = metrics.currentDayMinutes;
    }
    if (metrics.currentDayKeystrokes) {
        metricsOut.keystrokes = metrics.currentDayKeystrokes;
    }
    if (metrics.currentDayLinesAdded) {
        metricsOut.linesAdded = metrics.currentDayLinesAdded;
    }

    return metricsOut;
}
