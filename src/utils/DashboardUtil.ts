import path = require("path");
import fs = require("fs");
import { getDaysLevel, getHoursLevel, getLongStreakLevel, getLinesAddedLevel } from "./SummaryUtil";
import { Summary } from "../models/Summary";
import { getLastSevenLoggedDays, getAllCodetimeHours, getLogDateRange } from "./LogsUtil";
import { getMilestoneById } from "./MilestonesUtil";
import { monthNames } from "./Constants";
import { window } from "vscode";
import { fetchSummaryJsonFileData } from "../managers/FileManager";

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
            return `Complete 1 day to reach Level 1.`;
        case 1:
            return `Complete 10 days to reach Level 2.`;
        case 2:
            return `Complete 50 days to reach Level 3.`;
        case 3:
            return `Complete 75 days to reach Level 4.`;
        case 4:
            return `Complete 100 days to reach Level 5.`;
        case 5:
            return `Complete 110 days to reach Level <span class="inf">∞</span>.`;
        case 6:
            return `Congratulations, you're at Level <span class="inf">∞</span>!`;
        default:
            return "";
    }
}

function getHoursLevelTooltipText(level: number): string {
    switch (level) {
        case 0:
            return `Code 1 hour to reach Level 1.`;
        case 1:
            return `Code 30 hours to reach Level 2.`;
        case 2:
            return `Code 60 hours to reach Level 3.`;
        case 3:
            return `Code 90 hours to reach Level 4.`;
        case 4:
            return `Code 120 hours to reach Level 5.`;
        case 5:
            return `Code 200 hours to reach Level <span class="inf">∞</span>.`;
        case 6:
            return `Congratulations, you're at Level <span class="inf">∞</span>!`;
        default:
            return "";
    }
}

function getStreaksLevelTooltipText(level: number): string {
    switch (level) {
        case 0:
            return `Complete a 2-day streak to reach Level 1.`;
        case 1:
            return `Complete a 7-day streak to reach Level 2.`;
        case 2:
            return `Complete a 14-day streak to reach Level 3.`;
        case 3:
            return `Complete a 30-day streak to reach Level 4.`;
        case 4:
            return `Complete a 60-day streak to reach Level 5.`;
        case 5:
            return `Complete a 100-day streak to reach Level <span class="inf">∞</span>.`;
        case 6:
            return `Congratulations, you're at Level <span class="inf">∞</span>!`;
        default:
            return "";
    }
}

function getLinesAddedLevelTooltipText(level: number): string {
    switch (level) {
        case 0:
            return `Write 1 line of code to reach Level 1.`;
        case 1:
            return `Write 16 lines of code to reach Level 2.`;
        case 2:
            return `Write 50 lines of code to reach Level 3.`;
        case 3:
            return `Write 100 lines of code to reach Level 4.`;
        case 4:
            return `Write 1,000 lines of code to reach Level 5.`;
        case 5:
            return `Write 10,000 lines of code to reach Level <span class="inf">∞</span>.`;
        case 6:
            return `Congratulations, you're at Level <span class="inf">∞</span>!`;
        default:
            return "";
    }
}

function generateShareUrl(days: number, hours: number, streaks: number, linesAdded: number, avgHours: number): string {
    const hashtagURI = "%23";
    const shareText = [
        `\n\nDays coded: ${days}`,
        `Longest streak: ${streaks} days`,
        `Total hours coded: ${hours} hrs`,
        `Total lines added: ${linesAdded}`,
        `Avg hours/day: ${avgHours} hrs\n\n`
    ].join("\n");
    const shareURI = encodeURI(shareText);
    return `https://twitter.com/intent/tweet?url=https%3A%2F%2Fwww.software.com%2F100-days-of-code&text=My%20${hashtagURI}100DaysOfCode%20progress:${shareURI}via%20@software_hq's%20${hashtagURI}vscode%20extension`;
}

function getStyleColorsBasedOnMode(): any {
    const tempWindow: any = window;

    let cardTextColor = "#FFFFFF";
    let cardBackgroundColor = "rgba(255,255,255,0.05)";
    let datagramXMinColor = "rgba(170,170,170,1)";
    let datagramBackground = "rgba(0,0,0,0);";
    let cardToolTipColor = "rgba(109,109,109,0.9)";
    if (tempWindow.activeColorTheme.kind === 1) {
        cardTextColor = "#444444";
        cardBackgroundColor = "rgba(0,0,0,0.10)";
        datagramXMinColor = "#444444";
        datagramBackground = "rgba(0,0,0,0.10);";
        cardToolTipColor = "rgba(165,165,165,0.9)";
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
        max = parseFloat(max.toFixed(1));
        mid = (max - min) / 2;
        mid = parseFloat(mid.toFixed(1));
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
        barsHtml = `<div style="text-align: center; font-size: 14px; margin-top: 50px; margin-right: 25px;">No days logged yet.</div>`;
        max = 1;
        mid = 0.5;
    }

    return { barsHtml, xAxisDates, min, max, mid, dateJustifyContent };
}

function getLogsHtml(): string {
    // Logs
    const logs = getLastSevenLoggedDays();
    let logsHtml = "";

    const d = new Date();
    if (logs.length === 0) {
        logsHtml = `<div style="text-align: center; padding-top: 75px; font-size: 14px;">Complete your first log entry at the end of the day.</div>`;
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
            if (milestone) {
                milestoneHtml += [
                    `\t\t\t\t<div class="milestoneCard">`,
                    `\t\t\t\t\t<img class="logo"`,
                    `\t\t\t\t\tsrc="${milestone.icon}">`,
                    `\t\t\t\t\t<div class="milestoneData">`,
                    `\t\t\t\t\t\t<div class="milestoneTitle">${milestone.title}</div>`,
                    `\t\t\t\t\t\t<div class="milestoneDesc">${milestone.description}</div>`,
                    `\t\t\t\t\t</div>`,
                    `\t\t\t\t</div>`
                ].join("\n");
            }
            count -= 1;
            if (count === 0) {
                break;
            }
        }
    } else {
        milestoneHtml = `<div style="text-align: center; font-size: 14px; padding-right: 10px;">Check back later for achieved milestones.</div>`;
    }
    return milestoneHtml;
}

export function getUpdatedDashboardHtmlString(): string {
    const summary: Summary = fetchSummaryJsonFileData();

    // Metrics
    let hours = summary.hours + summary.currentHours;
    hours = parseFloat(hours.toFixed(2));
    let days = summary.days;
    let streaks = summary.longest_streak;
    const linesAdded = summary.lines_added + summary.currentLines;
    let avgHours = days > 0 ? parseFloat((hours / days).toFixed(2)) : 0;

    // view certificate if coded over 100 days
    let certificateVisibility = "hidden";
    if (days >= 100) {
        certificateVisibility = "visible";
    }

    const { daysLevel, daysProgressPercentage } = getDaysLevel(days);
    const { hoursLevel, hoursProgressPercentage } = getHoursLevel(hours);
    const { streaksLevel, streaksProgressPercentage } = getLongStreakLevel(streaks);
    const { linesAddedLevel, linesAddedProgressPercentage } = getLinesAddedLevel(linesAdded);

    const daysLevelTooltip = getDaysLevelTooltipText(daysLevel);
    const hoursLevelTooltip = getHoursLevelTooltipText(hoursLevel);
    const streaksLevelTooltip = getStreaksLevelTooltipText(streaksLevel);
    const linesAddedLevelTooltip = getLinesAddedLevelTooltipText(linesAddedLevel);
    const avgHoursLevelTooltip =
        avgHours >= 1 ? "Great job! You're on track to coding one hour every day." : "Try to code an hour each day.";

    const twitterShareUrl = generateShareUrl(days, hours, streaks, linesAdded, avgHours);

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

    const dayProgressPx = Math.round(daysProgressPercentage * 1.2);
    const hoursProgressPx = Math.round(hoursProgressPercentage * 1.2);
    const streakProgressPx = Math.round(streaksProgressPercentage * 1.2);
    const lineAddedProgressPx = Math.round(linesAddedProgressPercentage * 1.2);
    const avgHoursProgressPx = avgHours >= 1 ? 120 : Math.round(avgHours * 120);

    const dayProgressColor = daysLevel === 6 ? "#FD9808" : "#00b4ee";
    const hoursProgressColor = hoursLevel === 6 ? "#FD9808" : "#00b4ee";
    const streakProgressColor = streaksLevel === 6 ? "#FD9808" : "#00b4ee";
    const lineAddedProgressColor = linesAddedLevel === 6 ? "#FD9808" : "#00b4ee";
    const avgHoursProgressColor = avgHours >= 1 ? "#FD9808" : "#00b4ee";

    const templateVars = {
        hours,
        days,
        streaks,
        linesAdded,
        avgHours,
        daysLevelTooltip,
        hoursLevelTooltip,
        streaksLevelTooltip,
        linesAddedLevelTooltip,
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
        certificateVisibility,
        dayProgressPx,
        hoursProgressPx,
        streakProgressPx,
        lineAddedProgressPx,
        avgHoursProgressPx,
        dayProgressColor,
        hoursProgressColor,
        streakProgressColor,
        lineAddedProgressColor,
        avgHoursProgressColor
    };

    const templateString = fs.readFileSync(getDashboardTemplate()).toString();
    const fillTemplate = function (templateString: string, templateVars: any) {
        return new Function("return `" + templateString + "`;").call(templateVars);
    };

    const dashboardHtmlContent = fillTemplate(templateString, templateVars);
    return dashboardHtmlContent;
}
