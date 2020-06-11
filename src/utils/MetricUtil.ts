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
        codeTimeMetricsStr = fs.readFileSync(sessionSummaryFile).toString();
    } catch (err) {
        console.log(err);
        return [];
    }
    const minutes = JSON.parse(codeTimeMetricsStr).currentDayMinutes;
    const keystrokes = JSON.parse(codeTimeMetricsStr).currentDayKeystrokes;
    const linesAdded = JSON.parse(codeTimeMetricsStr).currentDayLinesAdded;

    return [minutes, keystrokes, linesAdded];
}
