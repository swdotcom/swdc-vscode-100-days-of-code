"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAverageHoursLevel = exports.getLinesAddedLevel = exports.getLongStreakLevel = exports.getHoursLevel = exports.getDaysLevel = exports.incrementSummaryShare = exports.updateSummaryLanguages = exports.setSummaryCurrentHours = exports.setSummaryTotalHours = exports.getSummaryTotalHours = exports.updateSummaryMilestones = exports.updateSummaryJson = exports.syncSummary = exports.compareLocalSummary = exports.deleteSummaryJson = void 0;
const Util_1 = require("./Util");
const fs = require("fs");
const LogsUtil_1 = require("./LogsUtil");
const LanguageUtil_1 = require("./LanguageUtil");
const MilestonesUtil_1 = require("./MilestonesUtil");
const FileManager_1 = require("../managers/FileManager");
function deleteSummaryJson() {
    const filepath = FileManager_1.getSummaryJsonFilePath();
    const fileExists = fs.existsSync(filepath);
    if (fileExists) {
        fs.unlinkSync(filepath);
    }
}
exports.deleteSummaryJson = deleteSummaryJson;
function compareLocalSummary(summaryFromApp) {
    let summary = FileManager_1.fetchSummaryJsonFileData();
    // updates local summary if and only if db is as updated
    if (summaryFromApp.days > summary.days || summaryFromApp.hours > summary.hours || summaryFromApp.keystrokes > summary.keystrokes) {
        const currentLog = LogsUtil_1.getMostRecentLogObject();
        summary.days = summaryFromApp.days;
        summary.hours = summaryFromApp.hours > summary.hours ? summaryFromApp.hours : summary.hours;
        summary.keystrokes = summaryFromApp.keystrokes > summary.keystrokes ? summaryFromApp.keystrokes : summary.keystrokes;
        summary.lines_added = summaryFromApp.lines_added > summary.lines_added ? summaryFromApp.lines_added : summary.lines_added;
        summary.longest_streak =
            summaryFromApp.longest_streak > summary.longest_streak ? summaryFromApp.longest_streak : summary.longest_streak;
        summary.milestones = summaryFromApp.milestones > summary.milestones ? summaryFromApp.milestones : summary.milestones;
        summary.shares = summaryFromApp.shares > summary.shares ? summaryFromApp.shares : summary.shares;
        summary.languages = Util_1.mergeStringArrays(summaryFromApp.languages, summary.languages);
        if (currentLog && Util_1.compareDates(new Date(currentLog.date), new Date())) {
            summary.currentHours = currentLog.codetime_metrics.hours;
            summary.currentKeystrokes = currentLog.codetime_metrics.keystrokes;
            summary.currentLines = currentLog.codetime_metrics.lines_added;
        }
    }
    writeToSummaryJson(summary);
}
exports.compareLocalSummary = compareLocalSummary;
function syncSummary() {
    console.log("Syncing 100 doc summary");
    // Aggregating log data
    const aggregateLogData = LogsUtil_1.getLogsSummary();
    // Aggregating milestone data
    const totalMilestones = MilestonesUtil_1.getTotalMilestonesAchieved();
    let summary = FileManager_1.fetchSummaryJsonFileData();
    //aggregate hours has the total hours in the logs, we need to subtract the current day's hours because they are added at the end of the day.
    summary.hours = aggregateLogData.totalHours;
    summary.lines_added = aggregateLogData.totalLinesAdded;
    summary.keystrokes = aggregateLogData.totalKeystrokes;
    summary.currentHours = aggregateLogData.currentHours;
    summary.currentKeystrokes = aggregateLogData.currentKeystrokes;
    summary.currentLines = aggregateLogData.currentLines;
    summary.days = aggregateLogData.totalDays;
    summary.longest_streak = aggregateLogData.longest_streak;
    summary.current_streak = aggregateLogData.current_streak;
    summary.milestones = totalMilestones;
    summary.recent_milestones = MilestonesUtil_1.getThreeMostRecentMilestones();
    summary.currentDate = aggregateLogData.currentDate;
    writeToSummaryJson(summary);
}
exports.syncSummary = syncSummary;
function updateSummaryJson() {
    let summary = FileManager_1.fetchSummaryJsonFileData();
    const log = LogsUtil_1.getMostRecentLogObject();
    const onStreak = LogsUtil_1.checkIfOnStreak();
    const currentDate = new Date(summary.currentDate);
    const dateOb = new Date();
    // if current date is not today, update aggregate data
    if (!Util_1.compareDates(dateOb, currentDate)) {
        summary.days += 1;
        summary.hours += summary.currentHours;
        summary.keystrokes += summary.currentKeystrokes;
        summary.lines_added += summary.currentLines;
        summary.currentDate = dateOb.valueOf();
        if (onStreak) {
            summary.current_streak += 1;
            if (summary.current_streak > summary.longest_streak) {
                summary.longest_streak = summary.current_streak;
            }
        }
        else {
            summary.current_streak = 1;
        }
    }
    // update day's data
    summary.currentHours = log.codetime_metrics.hours;
    summary.currentKeystrokes = log.codetime_metrics.keystrokes;
    summary.currentLines = log.codetime_metrics.lines_added;
    // update languages aggregate and make sure none are repeated
    const newLanguages = LanguageUtil_1.getLanguages();
    if (newLanguages) {
        const currLanguages = summary.languages || [];
        const totalLanguages = currLanguages.concat(newLanguages);
        const reducedLanguages = Array.from(new Set(totalLanguages));
        summary.languages = reducedLanguages;
    }
    summary.lastUpdated = new Date().getTime();
    writeToSummaryJson(summary);
}
exports.updateSummaryJson = updateSummaryJson;
function updateSummaryMilestones(newMilestones, totalMilestones) {
    let summary = FileManager_1.fetchSummaryJsonFileData();
    summary.milestones = totalMilestones;
    // order milestones in latest to oldest order of achievement
    summary.recent_milestones = newMilestones.reverse().concat(summary.recent_milestones);
    // limit milestones to 3 for displaying on the dashboard
    while (summary.recent_milestones.length > 3) {
        summary.recent_milestones.pop();
    }
    summary.lastUpdated = new Date().getTime();
    writeToSummaryJson(summary);
}
exports.updateSummaryMilestones = updateSummaryMilestones;
function getSummaryTotalHours() {
    let summary = FileManager_1.fetchSummaryJsonFileData();
    return summary.hours;
}
exports.getSummaryTotalHours = getSummaryTotalHours;
function setSummaryTotalHours(newHours) {
    let summary = FileManager_1.fetchSummaryJsonFileData();
    summary.hours = newHours;
    writeToSummaryJson(summary);
}
exports.setSummaryTotalHours = setSummaryTotalHours;
function setSummaryCurrentHours(newCurrentHours) {
    let summary = FileManager_1.fetchSummaryJsonFileData();
    summary.currentHours = newCurrentHours;
    writeToSummaryJson(summary);
}
exports.setSummaryCurrentHours = setSummaryCurrentHours;
function updateSummaryLanguages() {
    // update languages aggregate and make sure none are repeated
    const newLanguages = LanguageUtil_1.getLanguages();
    let summary = FileManager_1.fetchSummaryJsonFileData();
    const currLanguages = summary.languages;
    const totalLanguages = currLanguages.concat(newLanguages);
    const reducedLanguages = Array.from(new Set(totalLanguages));
    summary.languages = reducedLanguages;
    summary.lastUpdated = new Date().getTime();
    writeToSummaryJson(summary);
}
exports.updateSummaryLanguages = updateSummaryLanguages;
function incrementSummaryShare() {
    const summary = FileManager_1.fetchSummaryJsonFileData();
    summary.shares++;
    writeToSummaryJson(summary);
}
exports.incrementSummaryShare = incrementSummaryShare;
function getDaysLevel(daysComplete) {
    // based on days milestones
    let daysLevel = 0;
    let daysProgressPercentage = 0;
    if (daysComplete >= 110) {
        daysLevel = 6;
        daysProgressPercentage = 100;
    }
    else if (daysComplete >= 100) {
        daysLevel = 5;
        daysProgressPercentage = ((daysComplete - 100) * 100) / (110 - 100);
    }
    else if (daysComplete >= 75) {
        daysLevel = 4;
        daysProgressPercentage = ((daysComplete - 75) * 100) / (100 - 75);
    }
    else if (daysComplete >= 50) {
        daysLevel = 3;
        daysProgressPercentage = ((daysComplete - 50) * 100) / (75 - 50);
    }
    else if (daysComplete >= 10) {
        daysLevel = 2;
        daysProgressPercentage = ((daysComplete - 10) * 100) / (50 - 10);
    }
    else if (daysComplete >= 1) {
        daysLevel = 1;
        daysProgressPercentage = ((daysComplete - 1) * 100) / (10 - 1);
    }
    else {
        daysLevel = 0;
        daysProgressPercentage = (daysComplete * 100) / (1 - 0);
    }
    return { daysLevel, daysProgressPercentage };
}
exports.getDaysLevel = getDaysLevel;
function getHoursLevel(hoursCoded) {
    // based on hours milestones
    let hoursLevel = 0;
    let hoursProgressPercentage = 0;
    if (hoursCoded >= 200) {
        hoursLevel = 6;
        hoursProgressPercentage = 100;
    }
    else if (hoursCoded >= 120) {
        hoursLevel = 5;
        hoursProgressPercentage = ((hoursCoded - 120) * 100) / (200 - 120);
    }
    else if (hoursCoded >= 90) {
        hoursLevel = 4;
        hoursProgressPercentage = ((hoursCoded - 90) * 100) / (120 - 90);
    }
    else if (hoursCoded >= 60) {
        hoursLevel = 3;
        hoursProgressPercentage = ((hoursCoded - 60) * 100) / (90 - 60);
    }
    else if (hoursCoded >= 30) {
        hoursLevel = 2;
        hoursProgressPercentage = ((hoursCoded - 30) * 100) / (60 - 30);
    }
    else if (hoursCoded >= 1) {
        hoursLevel = 1;
        hoursProgressPercentage = ((hoursCoded - 1) * 100) / (30 - 1);
    }
    else {
        hoursLevel = 0;
        hoursProgressPercentage = (hoursCoded * 100) / (1 - 0);
    }
    return { hoursLevel, hoursProgressPercentage };
}
exports.getHoursLevel = getHoursLevel;
function getLongStreakLevel(longestStreak) {
    // based on streaks milestones
    let streaksLevel = 0;
    let streaksProgressPercentage = 0;
    if (longestStreak >= 100) {
        streaksLevel = 6;
        streaksProgressPercentage = 100;
    }
    else if (longestStreak >= 60) {
        streaksLevel = 5;
        streaksProgressPercentage = ((longestStreak - 60) * 100) / (100 - 60);
    }
    else if (longestStreak >= 30) {
        streaksLevel = 4;
        streaksProgressPercentage = ((longestStreak - 30) * 100) / (60 - 30);
    }
    else if (longestStreak >= 14) {
        streaksLevel = 3;
        streaksProgressPercentage = ((longestStreak - 14) * 100) / (30 - 14);
    }
    else if (longestStreak >= 7) {
        streaksLevel = 2;
        streaksProgressPercentage = ((longestStreak - 7) * 100) / (14 - 7);
    }
    else if (longestStreak >= 2) {
        streaksLevel = 1;
        streaksProgressPercentage = ((longestStreak - 2) * 100) / (7 - 2);
    }
    else {
        streaksLevel = 0;
        streaksProgressPercentage = (longestStreak * 100) / (2 - 0);
    }
    return { streaksLevel, streaksProgressPercentage };
}
exports.getLongStreakLevel = getLongStreakLevel;
function getLinesAddedLevel(linesAdded) {
    // based on number of lines added milestones
    let linesAddedLevel = 0;
    let linesAddedProgressPercentage = 0;
    if (linesAdded >= 10000) {
        linesAddedLevel = 6;
        linesAddedProgressPercentage = 100;
    }
    else if (linesAdded >= 1000) {
        linesAddedLevel = 5;
        linesAddedProgressPercentage = ((linesAdded - 1000) * 100) / (10000 - 1000);
    }
    else if (linesAdded >= 100) {
        linesAddedLevel = 4;
        linesAddedProgressPercentage = ((linesAdded - 100) * 100) / (1000 - 100);
    }
    else if (linesAdded >= 50) {
        linesAddedLevel = 3;
        linesAddedProgressPercentage = ((linesAdded - 50) * 100) / (100 - 50);
    }
    else if (linesAdded >= 16) {
        linesAddedLevel = 2;
        linesAddedProgressPercentage = ((linesAdded - 16) * 100) / (50 - 16);
    }
    else if (linesAdded >= 1) {
        linesAddedLevel = 1;
        linesAddedProgressPercentage = ((linesAdded - 1) * 100) / (16 - 1);
    }
    else {
        linesAddedLevel = 0;
        linesAddedProgressPercentage = (linesAdded * 100) / (1 - 0);
    }
    return { linesAddedLevel, linesAddedProgressPercentage };
}
exports.getLinesAddedLevel = getLinesAddedLevel;
function getAverageHoursLevel(avgHour) {
    // based on avg hours for 100 days of code
    if (avgHour >= 3.0) {
        return 6;
    }
    else if (avgHour >= 2.5) {
        return 5;
    }
    else if (avgHour >= 2.0) {
        return 4;
    }
    else if (avgHour >= 1.5) {
        return 3;
    }
    else if (avgHour >= 1.0) {
        return 2;
    }
    else if (avgHour >= 0.5) {
        return 1;
    }
    else {
        return 0;
    }
}
exports.getAverageHoursLevel = getAverageHoursLevel;
function writeToSummaryJson(summary) {
    const filepath = FileManager_1.getSummaryJsonFilePath();
    try {
        fs.writeFileSync(filepath, JSON.stringify(summary, null, 2));
    }
    catch (err) {
        console.log(err);
    }
}
//# sourceMappingURL=SummaryUtil.js.map