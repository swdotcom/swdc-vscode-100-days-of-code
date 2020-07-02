import { getSoftwareDir, isWindows, compareDates, getSoftwareSessionAsJson } from "./Util";
import fs = require("fs");
import { window } from "vscode";
import { getMostRecentLogObject, checkIfOnStreak, getLogsSummary } from "./LogsUtil";
import { getLanguages } from "./LanguageUtil";
import { Summary } from "../models/Summary";
import { Log } from "../models/Log";
import { getTotalMilestonesAchieved, getThreeMostRecentMilestones } from "./MilestonesUtil";

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
                    `\t"currentDate": ${date.valueOf()},`,
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

        const filepath = getSummaryJson();
        try {
            fs.writeFileSync(filepath, JSON.stringify(summary, null, 4));
        } catch (err) {
            console.log(err);
            return;
        }
    }
}

export function reevaluateSummary() {
    // Aggregating log data
    const aggregateLogData = getLogsSummary();

    // Aggregating milestone data
    const totalMilestones = getTotalMilestonesAchieved();

    let summary = getSummaryObject();
    //aggregate hours has the total hours in the logs, we need to subtract the current day's hours because they are added at the end of the day.
    summary.hours = aggregateLogData.totalHours - summary.currentHours;
    summary.lines_added = aggregateLogData.totalLinesAdded;
    summary.keystrokes = aggregateLogData.totalKeystrokes;
    summary.days = aggregateLogData.totalDays;
    summary.longest_streak = aggregateLogData.longest_streak;
    summary.current_streak = aggregateLogData.current_streak;
    summary.milestones = totalMilestones;
    summary.recent_milestones = getThreeMostRecentMilestones();

    const filepath = getSummaryJson();
    try {
        fs.writeFileSync(filepath, JSON.stringify(summary, null, 4));
    } catch (err) {
        console.log(err);
        return;
    }
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
    const filepath = getSummaryJson();
    try {
        fs.writeFileSync(filepath, JSON.stringify(summary, null, 4));
    } catch (err) {
        console.log(err);
        return;
    }
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
    const filepath = getSummaryJson();
    try {
        fs.writeFileSync(filepath, JSON.stringify(summary, null, 4));
    } catch (err) {
        console.log(err);
        return;
    }
}

export function getSummaryTotalHours() {
    let summary = getSummaryObject();
    return summary.hours;
}

export function setSummaryTotalHours(newHours: number) {
    let summary = getSummaryObject();
    summary.hours = newHours;
    const filepath = getSummaryJson();
    try {
        fs.writeFileSync(getSummaryJson(), JSON.stringify(summary, null, 4));
    } catch (err) {
        console.log(err);
        return;
    }
}

export function setSummaryCurrentHours(newCurrentHours: number) {
    let summary = getSummaryObject();
    summary.currentHours = newCurrentHours;
    const filepath = getSummaryJson();
    try {
        fs.writeFileSync(filepath, JSON.stringify(summary, null, 4));
    } catch (err) {
        console.log(err);
        return;
    }
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
    const filepath = getSummaryJson();
    try {
        fs.writeFileSync(filepath, JSON.stringify(summary, null, 4));
    } catch (err) {
        console.log(err);
        return;
    }
}

export function incrementSummaryShare() {
    const summary: Summary = getSummaryObject();
    summary.shares++;
    const filepath = getSummaryJson();
    try {
        fs.writeFileSync(filepath, JSON.stringify(summary, null, 4));
    } catch (err) {
        console.log(err);
        return;
    }
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

export function getDaysLevel(daysComplete: number): number {
    // based on days milestones
    if (daysComplete >= 110) {
        return 6;
    } else if (daysComplete >= 100) {
        return 5;
    } else if (daysComplete >= 75) {
        return 4;
    } else if (daysComplete >= 50) {
        return 3;
    } else if (daysComplete >= 10) {
        return 2;
    } else if (daysComplete >= 1) {
        return 1;
    } else {
        return 0;
    }
}

export function getHoursLevel(hoursCoded: number): number {
    // based on hours milestones
    if (hoursCoded >= 200) {
        return 6;
    } else if (hoursCoded >= 120) {
        return 5;
    } else if (hoursCoded >= 90) {
        return 4;
    } else if (hoursCoded >= 60) {
        return 3;
    } else if (hoursCoded >= 30) {
        return 2;
    } else if (hoursCoded >= 1) {
        return 1;
    } else {
        return 0;
    }
}

export function getLongStreakLevel(longestStreak: number): number {
    // based on streaks milestones
    if (longestStreak >= 100) {
        return 6;
    } else if (longestStreak >= 60) {
        return 5;
    } else if (longestStreak >= 30) {
        return 4;
    } else if (longestStreak >= 14) {
        return 3;
    } else if (longestStreak >= 7) {
        return 2;
    } else if (longestStreak >= 2) {
        return 1;
    } else {
        return 0;
    }
}

export function getMilestonesEarnedLevel(milestones: number): number {
    // based on number of milestones
    if (milestones >= 50) {
        return 6;
    } else if (milestones >= 40) {
        return 5;
    } else if (milestones >= 30) {
        return 4;
    } else if (milestones >= 20) {
        return 3;
    } else if (milestones >= 10) {
        return 2;
    } else if (milestones >= 1) {
        return 1;
    } else {
        return 0;
    }
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
