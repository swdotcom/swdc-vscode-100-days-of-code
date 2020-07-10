import { getSoftwareDir, isWindows, compareDates } from "./Util";
import fs = require("fs");
import { window } from "vscode";
import { getMostRecentLogObject, checkIfOnStreak, getLogsSummary } from "./LogsUtil";
import { getLanguages } from "./LanguageUtil";
import { Summary } from "../models/Summary";
import { Log } from "../models/Log";
import { getTotalMilestonesAchieved, getThreeMostRecentMilestones } from "./MilestonesUtil";
import { pushUpdatedSummary } from "./SummaryDbUtil";

function getSummaryJson() {
    let file = getSoftwareDir();
    if (isWindows()) {
        file += "\\userSummary.json";
    } else {
        file += "/userSummary.json";
    }
    return file;
}

export function checkSummaryJson() {
    const date = new Date();
    // checks if summary JSON exists. If not populates it with base values
    const filepath = getSummaryJson();
    try {
        if (fs.existsSync(filepath)) {
            return true;
        } else {
            fs.writeFileSync(
                filepath,
                [
                    `{\n\t"days": 0,`,
                    `\t"currentDate": 0,`,
                    `\t"currentHours": 0,`,
                    `\t"currentKeystrokes": 0,`,
                    `\t"currentLines": 0,`,
                    `\t"hours": 0,`,
                    `\t"longest_streak": 0,`,
                    `\t"milestones": 0,`,
                    `\t"lines_added": 0,`,
                    `\t"keystrokes": 0,`,
                    `\t"recent_milestones": [],`,
                    `\t"current_streak": 0,`,
                    `\t"shares": 0,`,
                    `\t"languages": [],`,
                    `\t"lastUpdated":  0\n}`
                ].join("\n")
            );
            return true;
        }
    } catch (err) {
        return false;
    }
}

export function compareLocalSummary(dbSummary: any) {
    let summary: Summary = getSummaryObject();

    // updates local summary if and only if db is as updated
    if (dbSummary.days >= summary.days) {
        const currentLog = getMostRecentLogObject();
        summary.days = dbSummary.days;
        summary.hours = dbSummary.hours > summary.hours ? dbSummary.hours : summary.hours;
        summary.keystrokes = dbSummary.keystrokes > summary.keystrokes ? dbSummary.keystrokes : summary.keystrokes;
        summary.lines_added = dbSummary.lines_added > summary.lines_added ? dbSummary.lines_added : summary.lines_added;
        summary.longest_streak =
            dbSummary.longest_streak > summary.longest_streak ? dbSummary.longest_streak : summary.longest_streak;
        summary.milestones = dbSummary.milestones > summary.milestones ? dbSummary.milestones : summary.milestones;
        summary.shares = dbSummary.shares > summary.shares ? dbSummary.shares : summary.shares;
        summary.languages =
            dbSummary.languages.length > summary.languages.length ? dbSummary.languages : summary.languages;
        if (currentLog && compareDates(new Date(currentLog.date), new Date())) {
            summary.currentHours = currentLog.codetime_metrics.hours;
            summary.currentKeystrokes = currentLog.codetime_metrics.keystrokes;
            summary.currentLines = currentLog.codetime_metrics.lines_added;
        }

        writeToSummaryJson(summary);
    }
    reevaluateSummary();
}

export function reevaluateSummary() {
    // Aggregating log data
    const aggregateLogData = getLogsSummary();

    // Aggregating milestone data
    const totalMilestones = getTotalMilestonesAchieved();

    let summary = getSummaryObject();
    //aggregate hours has the total hours in the logs, we need to subtract the current day's hours because they are added at the end of the day.
    summary.hours = aggregateLogData.totalHours - summary.currentHours;
    summary.lines_added = aggregateLogData.totalLinesAdded - summary.currentLines;
    summary.keystrokes = aggregateLogData.totalKeystrokes - summary.currentKeystrokes;

    summary.days = aggregateLogData.totalDays;
    summary.longest_streak = aggregateLogData.longest_streak;
    summary.current_streak = aggregateLogData.current_streak;

    summary.milestones = totalMilestones;
    summary.recent_milestones = getThreeMostRecentMilestones();

    writeToSummaryJson(summary);
    pushUpdatedSummary();
}

export function updateSummaryJson() {
    let summary: Summary = getSummaryObject();
    const log: Log = getMostRecentLogObject();
    const onStreak = checkIfOnStreak();
    const currentDate = new Date(summary.currentDate);
    const dateOb = new Date();

    // if current date is not today, update aggregate data
    if (!compareDates(dateOb, currentDate)) {
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
        } else {
            summary.current_streak = 1;
        }
    }

    // update day's data
    summary.currentHours = log.codetime_metrics.hours;
    summary.currentKeystrokes = log.codetime_metrics.keystrokes;
    summary.currentLines = log.codetime_metrics.lines_added;

    // update languages aggregate and make sure none are repeated
    const newLanguages = getLanguages();
    const currLanguages = summary.languages;
    const totalLanguages = currLanguages.concat(newLanguages);
    const reducedLanguages = Array.from(new Set(totalLanguages));
    summary.languages = reducedLanguages;

    summary.lastUpdated = new Date().getTime();
    writeToSummaryJson(summary);
}

export function updateSummaryMilestones(newMilestones: Array<number>, totalMilestones: number) {
    let summary = getSummaryObject();
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

export function getSummaryTotalHours() {
    let summary = getSummaryObject();
    return summary.hours;
}

export function setSummaryTotalHours(newHours: number) {
    let summary = getSummaryObject();
    summary.hours = newHours;
    writeToSummaryJson(summary);
}

export function setSummaryCurrentHours(newCurrentHours: number) {
    let summary = getSummaryObject();
    summary.currentHours = newCurrentHours;
    writeToSummaryJson(summary);
}

export function updateSummaryLanguages() {
    // update languages aggregate and make sure none are repeated
    const newLanguages = getLanguages();
    let summary = getSummaryObject();
    const currLanguages = summary.languages;
    const totalLanguages = currLanguages.concat(newLanguages);
    const reducedLanguages = Array.from(new Set(totalLanguages));
    summary.languages = reducedLanguages;
    summary.lastUpdated = new Date().getTime();
    writeToSummaryJson(summary);
}

export function incrementSummaryShare() {
    const summary: Summary = getSummaryObject();
    summary.shares++;
    writeToSummaryJson(summary);
}

export function getSummaryObject() {
    const exists = checkSummaryJson();
    if (!exists) {
        window.showErrorMessage("Cannot access Summary file! Please contact cody@software.com for help.");
    }
    const filepath = getSummaryJson();
    let rawSummary = fs.readFileSync(filepath).toString();
    return JSON.parse(rawSummary);
}

export function getDaysLevel(daysComplete: number): any {
    // based on days milestones
    let daysLevel = 0;
    let daysProgressPercentage = 0;
    if (daysComplete >= 110) {
        daysLevel = 6;
        daysProgressPercentage = 100;
    } else if (daysComplete >= 100) {
        daysLevel = 5;
        daysProgressPercentage = ((daysComplete - 100) * 100) / (110 - 100);
    } else if (daysComplete >= 75) {
        daysLevel = 4;
        daysProgressPercentage = ((daysComplete - 75) * 100) / (100 - 75);
    } else if (daysComplete >= 50) {
        daysLevel = 3;
        daysProgressPercentage = ((daysComplete - 50) * 100) / (75 - 50);
    } else if (daysComplete >= 10) {
        daysLevel = 2;
        daysProgressPercentage = ((daysComplete - 10) * 100) / (50 - 10);
    } else if (daysComplete >= 1) {
        daysLevel = 1;
        daysProgressPercentage = ((daysComplete - 1) * 100) / (10 - 1);
    } else {
        daysLevel = 0;
        daysProgressPercentage = (daysComplete * 100) / (1 - 0);
    }
    return { daysLevel, daysProgressPercentage };
}

export function getHoursLevel(hoursCoded: number): any {
    // based on hours milestones
    let hoursLevel = 0;
    let hoursProgressPercentage = 0;
    if (hoursCoded >= 200) {
        hoursLevel = 6;
        hoursProgressPercentage = 100;
    } else if (hoursCoded >= 120) {
        hoursLevel = 5;
        hoursProgressPercentage = ((hoursCoded - 120) * 100) / (200 - 120);
    } else if (hoursCoded >= 90) {
        hoursLevel = 4;
        hoursProgressPercentage = ((hoursCoded - 90) * 100) / (120 - 90);
    } else if (hoursCoded >= 60) {
        hoursLevel = 3;
        hoursProgressPercentage = ((hoursCoded - 60) * 100) / (90 - 60);
    } else if (hoursCoded >= 30) {
        hoursLevel = 2;
        hoursProgressPercentage = ((hoursCoded - 30) * 100) / (60 - 30);
    } else if (hoursCoded >= 1) {
        hoursLevel = 1;
        hoursProgressPercentage = ((hoursCoded - 1) * 100) / (30 - 1);
    } else {
        hoursLevel = 0;
        hoursProgressPercentage = (hoursCoded * 100) / (1 - 0);
    }
    return { hoursLevel, hoursProgressPercentage };
}

export function getLongStreakLevel(longestStreak: number): any {
    // based on streaks milestones
    let streaksLevel = 0;
    let streaksProgressPercentage = 0;
    if (longestStreak >= 100) {
        streaksLevel = 6;
        streaksProgressPercentage = 100;
    } else if (longestStreak >= 60) {
        streaksLevel = 5;
        streaksProgressPercentage = ((longestStreak - 60) * 100) / (100 - 60);
    } else if (longestStreak >= 30) {
        streaksLevel = 4;
        streaksProgressPercentage = ((longestStreak - 30) * 100) / (60 - 30);
    } else if (longestStreak >= 14) {
        streaksLevel = 3;
        streaksProgressPercentage = ((longestStreak - 14) * 100) / (30 - 14);
    } else if (longestStreak >= 7) {
        streaksLevel = 2;
        streaksProgressPercentage = ((longestStreak - 7) * 100) / (14 - 7);
    } else if (longestStreak >= 2) {
        streaksLevel = 1;
        streaksProgressPercentage = ((longestStreak - 2) * 100) / (7 - 2);
    } else {
        streaksLevel = 0;
        streaksProgressPercentage = (longestStreak * 100) / (2 - 0);
    }
    return { streaksLevel, streaksProgressPercentage };
}

export function getLinesAddedLevel(linesAdded: number): any {
    // based on number of lines added milestones
    let linesAddedLevel = 0;
    let linesAddedProgressPercentage = 0;
    if (linesAdded >= 10000) {
        linesAddedLevel = 6;
        linesAddedProgressPercentage = 100;
    } else if (linesAdded >= 1000) {
        linesAddedLevel = 5;
        linesAddedProgressPercentage = ((linesAdded - 1000) * 100) / (10000 - 1000);
    } else if (linesAdded >= 100) {
        linesAddedLevel = 4;
        linesAddedProgressPercentage = ((linesAdded - 100) * 100) / (1000 - 100);
    } else if (linesAdded >= 50) {
        linesAddedLevel = 3;
        linesAddedProgressPercentage = ((linesAdded - 50) * 100) / (100 - 50);
    } else if (linesAdded >= 16) {
        linesAddedLevel = 2;
        linesAddedProgressPercentage = ((linesAdded - 16) * 100) / (50 - 16);
    } else if (linesAdded >= 1) {
        linesAddedLevel = 1;
        linesAddedProgressPercentage = ((linesAdded - 1) * 100) / (16 - 1);
    } else {
        linesAddedLevel = 0;
        linesAddedProgressPercentage = (linesAdded * 100) / (1 - 0);
    }
    return { linesAddedLevel, linesAddedProgressPercentage };
}

export function getAverageHoursLevel(avgHour: number): number {
    // based on avg hours for 100 days of code
    if (avgHour >= 3.0) {
        return 6;
    } else if (avgHour >= 2.5) {
        return 5;
    } else if (avgHour >= 2.0) {
        return 4;
    } else if (avgHour >= 1.5) {
        return 3;
    } else if (avgHour >= 1.0) {
        return 2;
    } else if (avgHour >= 0.5) {
        return 1;
    } else {
        return 0;
    }
}

function writeToSummaryJson(summary: Summary) {
    const filepath = getSummaryJson();
    try {
        fs.writeFileSync(filepath, JSON.stringify(summary, null, 4));
    } catch (err) {
        console.log(err);
    }
}
