import { getSoftwareDir, isWindows, compareDates } from "./Util";
import fs = require("fs");
import { window } from "vscode";
import { getMostRecentLogObject, checkLogsJson, checkIfOnStreak } from "./LogsUtil";
import { getLanguages } from "./LanguageUtil";
import { Summary } from "../models/Summary";
import { Log } from "../models/Log";

export function getSummaryJson() {
    let file = getSoftwareDir();
    if (isWindows()) {
        file += "\\userSummary.json";
    } else {
        file += "/userSummary.json";
    }
    return file;
}

export function checkSummaryJson() {
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
                    `\t"curr_streak": 0,`,
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

export function updateSummaryJson() {
    const summaryExists = checkSummaryJson();
    const logsExists = checkLogsJson();
    if (!summaryExists || !logsExists) {
        return;
    }
    let summary: Summary = getSummaryObject();
    const log: Log = getMostRecentLogObject();
    const onStreak = checkIfOnStreak();
    const currentDate = new Date(summary.currentDate);
    const dateOb = new Date();

    if (!compareDates(dateOb, currentDate)) {
        summary.days += 1;
        summary.hours += summary.currentHours;
        summary.keystrokes += summary.currentKeystrokes;
        summary.lines_added += summary.currentLines;
        summary.currentDate = dateOb.valueOf();

        if (onStreak) {
            summary.curr_streak += 1;
            if (summary.curr_streak > summary.longest_streak) {
                summary.longest_streak = summary.curr_streak;
            }
        } else {
            summary.curr_streak = 1;
        }
    }
    summary.currentHours = log.codetime_metrics.hours;
    summary.currentKeystrokes = log.codetime_metrics.keystrokes;
    summary.currentLines = log.codetime_metrics.lines_added;

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
    const summaryExists = checkSummaryJson();
    if (!summaryExists) {
        return;
    }
    let summary = getSummaryObject();
    summary.milestones = totalMilestones;
    summary.recent_milestones = newMilestones.reverse().concat(summary.recent_milestones);
    while (summary.recent_milestones.length > 5) {
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
    const summaryExists = checkSummaryJson();
    if (!summaryExists) {
        return;
    }
    let summary = getSummaryObject();
    return summary.hours;
}

export function setSummaryTotalHours(newHours: number) {
    const summaryExists = checkSummaryJson();
    if (!summaryExists) {
        return;
    }
    let summary = getSummaryObject();
    summary.hours = newHours;
    const filepath = getSummaryJson();
    try {
        fs.writeFileSync(filepath, JSON.stringify(summary, null, 4));
    } catch (err) {
        console.log(err);
        return;
    }
}

export function setSummaryCurrentHours(newCurrentHours: number) {
    const summaryExists = checkSummaryJson();
    if (!summaryExists) {
        return;
    }
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
    const summaryExists = checkSummaryJson();
    if (!summaryExists) {
        return;
    }

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
        window.showErrorMessage("Cannot access Summary file!");
    }
    const filepath = getSummaryJson();
    let rawSummary = fs.readFileSync(filepath).toString();
    return JSON.parse(rawSummary);
}

export function getDaysLevel(daysComplete: number): number {
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
