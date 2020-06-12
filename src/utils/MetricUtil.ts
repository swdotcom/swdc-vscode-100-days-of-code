import { getSoftwareDir, isWindows } from "./Util";
import fs = require("fs");

export function getSessionSummaryJson() {
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
    let codeTimeMetricsStr: string;
    try {
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
    const metrics = JSON.parse(codeTimeMetricsStr);
    let minutes: number = 0;
    let keystrokes: number = 0;
    let linesAdded: number = 0;

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
