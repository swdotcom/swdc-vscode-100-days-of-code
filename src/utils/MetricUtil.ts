import { getSoftwareDir, isWindows, compareDates, getFileDataAsJson } from "./Util";
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

function getTimeCounterJson() {
    let file = getSoftwareDir();
    if (isWindows()) {
        file += "\\timeCounter.json";
    } else {
        file += "/timeCounter.json";
    }
    return file;
}

function getMinutesCoded(): number {
    const timeCounterFile = getTimeCounterJson();
    let minutes = 0;
    let timeCounterMetrics;
    try {
        // retries help when a user downloads Code Time with 100 Days of Code
        // they allow the file to be created and not throw errors
        let exists = false;
        let retries = 5;
        while (retries > 0 && !exists) {
            exists = fs.existsSync(timeCounterFile);
            retries--;
        }
        if (exists) {
            timeCounterMetrics = getFileDataAsJson(timeCounterFile, {});
        } else {
            return minutes;
        }
    } catch (err) {
        return minutes;
    }

    // checks if file was updated today
    const day: string = timeCounterMetrics.current_day;
    const dayArr = day.split("-");
    const year = parseInt(dayArr[0]);
    const month = parseInt(dayArr[1]);
    const date = parseInt(dayArr[2]);
    const dateNow = new Date();
    if (year === dateNow.getFullYear() && month === dateNow.getMonth() + 1 && date === dateNow.getDate()) {
        // checks for avoiding null and undefined
        if (timeCounterMetrics.cumulative_code_time_seconds) {
            minutes = timeCounterMetrics.cumulative_code_time_seconds / 60;
        }
    }
    return minutes;
}

export function getSessionCodetimeMetrics(): any {
    const sessionSummaryFile = getSessionSummaryJson();

    let metricsOut = {
        minutes: getMinutesCoded(),
        keystrokes: 0,
        linesAdded: 0
    };

    // try to get codetime metrics from session summary file
    let metrics;
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
            const stats = fs.statSync(sessionSummaryFile);
            // checks if file was updated today
            if (compareDates(new Date(), stats.mtime)) {
                metrics = getFileDataAsJson(sessionSummaryFile, {});
            } else {
                return metricsOut;
            }
        } else {
            return metricsOut;
        }
    } catch (err) {
        return metricsOut;
    }

    // checks for avoiding null and undefined
    if (metrics.currentDayKeystrokes) {
        metricsOut.keystrokes = metrics.currentDayKeystrokes;
    }
    if (metrics.currentDayLinesAdded) {
        metricsOut.linesAdded = metrics.currentDayLinesAdded;
    }

    return metricsOut;
}
