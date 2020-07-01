import path = require("path");
import fs = require("fs");
import {
    getSummaryObject,
    getDaysLevel,
    getHoursLevel,
    getLongStreakLevel,
    getMilestonesEarnedLevel,
    getAverageHoursLevel
} from "./SummaryUtil";
import { Summary } from "../models/Summary";
import { getLastSevenLoggedDays, getAllCodetimeHours, getLogDateRange } from "./LogsUtil";
import { getMilestoneById } from "./MilestonesUtil";
import { monthNames, HOURS_THRESHOLD } from "./Constants";
import { window } from "vscode";

function getDashboardTemplate(): string {
    return path.join(__dirname, "../assets/templates/dashboard.template.html");
}

export function getCertificateHtmlString(name: string): string {
    return [
        `<html>`,
        `\t<body>`,
        `\t\t<div id="container" style="position: relative; text-align: center; margin-top: 1vh;">`,
        `\t\t\t<img`,
        `\t\t\t\tid="Certificate"`,
        `\t\t\t\tsrc="https://100-days-of-code.s3-us-west-1.amazonaws.com/Certificate.svg"`,
        `\t\t\t\twidth="100%"`,
        `\t\t\t\talt="Software 100 Days of Code certificate"`,
        `\t\t\t/>`,
        `\t\t\t<div`,
        `\t\t\t\tid="text"`,
        `\t\t\t\tstyle="`,
        `\tposition: absolute;`,
        `\ttop: 38%;`,
        `\tleft: 0;`,
        `\ttext-align: center;`,
        `\twidth: 100%;`,
        `\tfont-family: sans-serif;`,
        `\tcolor: white;`,
        `\tfont-size: 5vw;`,
        `"`,
        `\t\t\t>`,
        `\t\t\t\t${name}`,
        `\t\t\t</div>`,
        `\t\t</div>`,
        `\t</body>`,
        `</html>`
    ].join("\n");
}

function getDaysLevelTooltipText(level: number): string {
    switch (level) {
        case 0:
            return "Complete 1 more day to reach Level 1 of Days Milestones";
        case 1:
            return `You're at Level 1 of Days Milestones. Complete 10 days to reach Level 2.`;
        case 2:
            return `You're at Level 2 of Days Milestones. Complete 50 days to reach Level 3.`;
        case 3:
            return `You're at Level 3 of Days Milestones. Complete 75 days to reach Level 4.`;
        case 4:
            return `You're at Level 4 of Days Milestones. Complete 100 days to reach Level 5.`;
        case 5:
            return `You're at Level 5 of Days Milestones. Complete 110 days to reach Level <span class="inf">∞</span>.`;
        case 6:
            return `Congratulations, you're at Level <span class="inf">∞</span> of Days Milestones!`;
        default:
            return "";
    }
}

function getHoursLevelTooltipText(level: number): string {
    switch (level) {
        case 0:
            return `Complete 1 more hour to reach Level 1 of Hours Milestones`;
        case 1:
            return `You're at Level 1 of Hours Milestones. Complete 30 hours to reach Level 2.`;
        case 2:
            return `You're at Level 2 of Hours Milestones. Complete 60 hours to reach Level 3.`;
        case 3:
            return `You're at Level 3 of Hours Milestones. Complete 90 hours to reach Level 4.`;
        case 4:
            return `You're at Level 4 of Hours Milestones. Complete 120 hours to reach Level 5.`;
        case 5:
            return `You're at Level 5 of Hours Milestones. Complete 200 hours to reach Level <span class="inf">∞</span>.`;
        case 6:
            return `Congratulations, you're at Level <span class="inf">∞</span> of Hours Milestones!`;
        default:
            return "";
    }
}

function getStreaksLevelTooltipText(level: number): string {
    switch (level) {
        case 0:
            return "Complete a 2 day streak to reach Level 1 of Streaks Milestones";
        case 1:
            return `You're at Level 1 of Streaks Milestones. Complete a 7 day streak to reach Level 2.`;
        case 2:
            return `You're at Level 2 of Streaks Milestones. Complete a 14 day streak to reach Level 3.`;
        case 3:
            return `You're at Level 3 of Streaks Milestones. Complete a 30 day streak to reach Level 4.`;
        case 4:
            return `You're at Level 4 of Streaks Milestones. Complete a 60 day streak to reach Level 5.`;
        case 5:
            return `You're at Level 5 of Streaks Milestones. Complete a 100 day streak to reach Level <span class="inf">∞</span>.`;
        case 6:
            return `Congratulations, you're at Level <span class="inf">∞</span> of Streaks Milestones!`;
        default:
            return "";
    }
}

function getMilestonesLevelTooltipText(level: number): string {
    switch (level) {
        case 0:
            return "Achieve 1 Milestone to reach Level 1 of Milestones";
        case 1:
            return `You're at Level 1 of Milestones. Achieve 10 Milestones to reach Level 2.`;
        case 2:
            return `You're at Level 2 of Milestones. Achieve 20 Milestones to reach Level 3.`;
        case 3:
            return `You're at Level 3 of Milestones. Achieve 30 Milestones to reach Level 4.`;
        case 4:
            return `You're at Level 4 of Milestones. Achieve 40 Milestones to reach Level 5.`;
        case 5:
            return `You're at Level 5 of Milestones. Achieve 50 Milestones to reach Level <span class="inf">∞</span>.`;
        case 6:
            return `Congratulations, you're at Level <span class="inf">∞</span> of Milestones!`;
        default:
            return "";
    }
}

function getAvgHoursLevelTooltipText(level: number): string {
    switch (level) {
        case 0:
            return "Achieve a 0.5 hour average to reach Level 1 of Average Hours";
        case 1:
            return `You're at Level 1 of Average Hours. Achieve a 1.0 hour average to reach Level 2.`;
        case 2:
            return `You're at Level 2 of Average Hours. Achieve a 1.5 hour average to reach Level 3.`;
        case 3:
            return `You're at Level 3 of Average Hours. Achieve a 2.0 hour average to reach Level 4.`;
        case 4:
            return `You're at Level 4 of Average Hours. Achieve a 2.5 hour average to reach Level 5.`;
        case 5:
            return `You're at Level 5 of Average Hours. Achieve a 3.0 hour average to reach Level <span class="inf">∞</span>.`;
        case 6:
            return `Congratulations, you're at Level <span class="inf">∞</span> of Average Hours!`;
        default:
            return "";
    }
}

function generateShareUrl(days: number, hours: number, streaks: number, milestones: number, avgHours: number): string {
    const hashtagURI = "%23";
    const shareText = [
        `\nDays: ${days}`,
        `Total Hours Coded: ${hours} hrs`,
        `Longest Streak: ${streaks} days`,
        `Milestones Earned: ${milestones}`,
        `Avg Hours/Day: ${avgHours} hrs\n`
    ].join("\n");
    const shareURI = encodeURI(shareText);
    return `https://twitter.com/intent/tweet?url=https%3A%2F%2Fwww.software.com%2F100-days-of-code&text=My%20${hashtagURI}100DaysOfCode%20Progress:${shareURI}I%27m%20using%20@software_hq%27s%20${hashtagURI}100DaysOfCode%20${hashtagURI}vscode%20extension`;
}

function getStyleColorsBasedOnMode(): any {
    const tempWindow: any = window;

    let cardTextColor = "#FFFFFF";
    let cardBackgroundColor = "rgba(255,255,255,0.05)";
    let datagramXMinColor = "#FFFFFF";
    let datagramBackground = "rgba(0,0,0,0);";
    let cardToolTipColor = "rgba(109, 109, 109, .9)";
    if (tempWindow.activeColorTheme.kind === 1) {
        cardTextColor = "#444444";
        cardBackgroundColor = "rgba(0,0,0,0.10)";
        datagramXMinColor = "#444444";
        datagramBackground = "rgba(0,0,0,0.10);";
        cardToolTipColor = "rgba(165, 165, 165, .9)";
    }
    return { cardTextColor, cardBackgroundColor, datagramXMinColor, datagramBackground, cardToolTipColor };
}

function getDatagramHtmlComponents(): any {
    // Datagram
    const codeTimeHours: Array<number> = getAllCodetimeHours();
    let max = 0;
    let mid = 0;
    const min = 0;
    let barsHtml = "";
    let dateJustifyContent = "space-between";
    let xAxisDates = "";
    if (codeTimeHours.length > 0) {
        max = Math.max(...codeTimeHours);
        mid = (max - min) / 2;
        for (let i = 0; i < codeTimeHours.length; i++) {
            let size = (codeTimeHours[i] * 250) / max;
            let transform = 250 - size;
            barsHtml += `\t\t\t\t<div class="chartBar" style="height: ${size}px; transform: translateY(${transform}px);"></div>\n`;
        }
        if (codeTimeHours.length < 3) {
            dateJustifyContent = "space-around";
        }
        let datesFromLogs = getLogDateRange();
        if (codeTimeHours.length < 10) {
            if (codeTimeHours.length > 1) {
                const dateObOne = new Date(datesFromLogs[0]);
                const dayOne = dateObOne.getDate();
                const monthOne = dateObOne.getMonth() + 1;
                const dateObTwo = new Date(datesFromLogs[1]);
                const dayTwo = dateObTwo.getDate();
                const monthTwo = dateObTwo.getMonth() + 1;
                xAxisDates = [
                    `\t\t\t\t<div class="chartDateText">${monthOne}/${dayOne}</div>`,
                    `\t\t\t\t<div class="chartDateText">${monthTwo}/${dayTwo}</div>`
                ].join("\n");
            } else {
                const dateObOne = new Date(datesFromLogs[0]);
                const dayOne = dateObOne.getDate();
                const monthOne = dateObOne.getMonth() + 1;
                xAxisDates = `\t\t\t\t<div class="chartDateText">${monthOne}/${dayOne}</div>`;
            }
        } else {
            const midDate = Math.ceil((datesFromLogs[0] + datesFromLogs[1]) / 2);
            const dateObOne = new Date(datesFromLogs[0]);
            const dayOne = dateObOne.getDate();
            const monthOne = dateObOne.getMonth() + 1;
            const dateObTwo = new Date(midDate);
            const dayTwo = dateObTwo.getDate();
            const monthTwo = dateObTwo.getMonth() + 1;
            const dateObThree = new Date(datesFromLogs[1]);
            const dayThree = dateObThree.getDate();
            const monthThree = dateObThree.getMonth() + 1;
            xAxisDates = [
                `\t\t\t\t<div class="chartDateText">${monthOne}/${dayOne}</div>`,
                `\t\t\t\t<div class="chartDateText">${monthTwo}/${dayTwo}</div>`,
                `\t\t\t\t<div class="chartDateText">${monthThree}/${dayThree}</div>`
            ].join("\n");
        }
    }
    // no days
    if (barsHtml === "" || max === 0) {
        barsHtml = `<div style="text-align: center; font-size: 14px; font-weight: bolder; margin-top: 50px; margin-right: 25px;">Waiting for your Code Time data!</div>`;
    }

    return { barsHtml, xAxisDates, min, max, mid, dateJustifyContent };
}

function getLogsHtml(): string {
    // Logs
    const logs = getLastSevenLoggedDays();
    let logsHtml = "";

    const d = new Date();
    if (logs.length === 0) {
        logsHtml = `<div style="text-align: center; padding-top: 75px; font-size: 14px; font-weight: bolder;">Excited for you to start your 1st day in #100DaysOfCode Challenge!</div>`;
    } else {
        for (let i = 0; i < logs.length; i++) {
            logsHtml += `\t\t\t<div class="logBody">\n\t\t\t\t<span>${logs[i].day_number}</span>\n`;
            const dateOb = new Date(logs[i].date);
            const day = dateOb.getDate();
            const month = monthNames[dateOb.getMonth()];
            const year = dateOb.getFullYear();
            logsHtml += `\t\t\t\t<span>${day} ${month} ${year}</span>\n`;
            logsHtml += `\t\t\t\t<span>${logs[i].title}</span>\n\t\t\t</div>`;
        }
    }
    return logsHtml;
}

function getMilestonesHtml(recent_milestones: Array<number>): string {
    // Milestones
    let milestoneHtml = "";
    if (recent_milestones.length > 0) {
        let count = 3;
        for (let i = 0; i < recent_milestones.length; i++) {
            const milestoneId = recent_milestones[i];
            const milestone = getMilestoneById(milestoneId);
            milestoneHtml += [
                `\t\t\t\t<div class="milestoneCard">`,
                `\t\t\t\t\t<img class="logo"`,
                `\t\t\t\t\tsrc="${milestone.icon}"`,
                `\t\t\t\t\talt="Connect internet to view this really cool logo!">`,
                `\t\t\t\t\t<div class="milestoneData">`,
                `\t\t\t\t\t\t<div class="milestoneTitle">${milestone.title}</div>`,
                `\t\t\t\t\t\t<div class="milestoneDesc">${milestone.description}</div>`,
                `\t\t\t\t\t</div>`,
                `\t\t\t\t</div>`
            ].join("\n");
            count -= 1;
            if (count === 0) {
                break;
            }
        }
    } else {
        milestoneHtml = `<div style="text-align: center; padding-top: 75px; font-size: 14px; font-weight: bolder; padding-right: 10px;">Excited for you to achieve your 1st Milestone!</div>`;
    }
    return milestoneHtml;
}

export function getUpdatedDashboardHtmlString(): string {
    const summary: Summary = getSummaryObject();

    // Metrics
    let hours = summary.hours + summary.currentHours;
    hours = parseFloat(hours.toFixed(2));
    let days = summary.days;
    let streaks = summary.longest_streak;
    const currStreak = summary.current_streak;
    const milestones = summary.milestones;
    let avgHours = parseFloat((hours / days).toFixed(2));

    if (summary.currentHours < HOURS_THRESHOLD) {
        days--;
        if (streaks === currStreak) {
            streaks--;
        }
        if (days === 0) {
            avgHours = 0;
        }
    }

    // view certificate if coded over HOURS_THRESHOLD on 100th day or over 100 days of coding achieved
    let certificateVisibility = "hidden";
    if (days > 100 || (days === 100 && summary.currentHours >= HOURS_THRESHOLD)) {
        certificateVisibility = "visible";
    }

    const daysLevel = getDaysLevel(days);
    const hoursLevel = getHoursLevel(hours);
    const streaksLevel = getLongStreakLevel(streaks);
    const milestonesLevel = getMilestonesEarnedLevel(milestones);
    const avgHoursLevel = getAverageHoursLevel(avgHours);

    const daysLevelTooltip = getDaysLevelTooltipText(daysLevel);
    const hoursLevelTooltip = getHoursLevelTooltipText(hoursLevel);
    const streaksLevelTooltip = getStreaksLevelTooltipText(streaksLevel);
    const milestonesLevelTooltip = getMilestonesLevelTooltipText(milestonesLevel);
    const avgHoursLevelTooltip = getAvgHoursLevelTooltipText(avgHoursLevel);

    const twitterShareUrl = generateShareUrl(days, hours, streaks, milestones, avgHours);

    const {
        cardTextColor,
        cardBackgroundColor,
        datagramXMinColor,
        datagramBackground,
        cardToolTipColor
    } = getStyleColorsBasedOnMode();

    const { barsHtml, xAxisDates, min, max, mid, dateJustifyContent } = getDatagramHtmlComponents();

    const logsHtml = getLogsHtml();

    const milestoneHtml = getMilestonesHtml(summary.recent_milestones);

    const templateVars = {
        hours,
        days,
        streaks,
        milestones,
        avgHours,
        daysLevel,
        hoursLevel,
        streaksLevel,
        milestonesLevel,
        avgHoursLevel,
        daysLevelTooltip,
        hoursLevelTooltip,
        streaksLevelTooltip,
        milestonesLevelTooltip,
        avgHoursLevelTooltip,
        twitterShareUrl,
        cardTextColor,
        cardBackgroundColor,
        datagramXMinColor,
        datagramBackground,
        cardToolTipColor,
        barsHtml,
        xAxisDates,
        min,
        max,
        mid,
        dateJustifyContent,
        logsHtml,
        milestoneHtml,
        certificateVisibility
    };

    const templateString = fs.readFileSync(getDashboardTemplate()).toString();
    const fillTemplate = function (templateString: string, templateVars: any) {
        return new Function("return `" + templateString + "`;").call(templateVars);
    };

    const dashboardHtmlContent = fillTemplate(templateString, templateVars);
    return dashboardHtmlContent;
}
