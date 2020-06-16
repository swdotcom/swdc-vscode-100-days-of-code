import { getSoftwareDir, isWindows } from "./Util";
import fs = require("fs");
import {
    getUserObject,
    getDaysLevel,
    getHoursLevel,
    getLongStreakLevel,
    getMilestonesEarnedLevel,
    getAverageHoursLevel
} from "./UserUtil";
import { User } from "../models/User";
import { getLastSevenLoggedDays, getAllCodetimeHours, getLogDateRange } from "./LogsUtil";
import { getMilestoneById, milestoneShareUrlGenerator } from "./MilestonesUtil";

export function getDashboardHtml() {
    let file = getSoftwareDir();
    if (isWindows()) {
        file += "\\dashboard.html";
    } else {
        file += "/dashboard.html";
    }
    return file;
}

export function getUpdatedDashboardHtmlString() {
    const user: User = getUserObject();

    // Metrics
    const hours = parseFloat((user.hours + user.currentHours).toFixed(2));
    let days = user.days;
    let streaks = user.longest_streak;
    let avgHours = parseFloat((hours / days).toFixed(2));
    if (user.currentHours < 0.5) {
        days--;
        streaks--;
        if (days === 0) {
            avgHours = 0;
        }
    }
    const daysLevel = getDaysLevel(days);
    const hoursLevel = getHoursLevel(hours);
    const longStreakLevel = getLongStreakLevel(streaks);
    const milestoneLevel = getMilestonesEarnedLevel(user.milestones);
    const avgHoursLevel = getAverageHoursLevel(avgHours);

    let daysLevelHtml;
    switch (daysLevel) {
        case 0:
            daysLevelHtml =
                '\t\t<div class="tooltiptext">Complete 1 more day to reach Level 1 of Days Milestones</div>';
            break;
        case 1:
            daysLevelHtml = `\t\t<div class="tooltiptext">You're at Level 1 of Days Milestones. Complete 10 days to reach Level 2.</div>`;
            break;
        case 2:
            daysLevelHtml = `\t\t<div class="tooltiptext">You're at Level 2 of Days Milestones. Complete 50 days to reach Level 3.</div>`;
            break;
        case 3:
            daysLevelHtml = `\t\t<div class="tooltiptext">You're at Level 3 of Days Milestones. Complete 75 days to reach Level 4.</div>`;
            break;
        case 4:
            daysLevelHtml = `\t\t<div class="tooltiptext">You're at Level 4 of Days Milestones. Complete 100 days to reach Level 5.</div>`;
            break;
        case 5:
            daysLevelHtml = `\t\t<div class="tooltiptext">You're at Level 5 of Days Milestones. Complete 110 days to reach Level <span class="inf">∞</span>.</div>`;
            break;
        case 6:
            daysLevelHtml = `\t\t<div class="tooltiptext">Congratulations, you're at Level <span class="inf">∞</span> of Days Milestones!</div>`;
            break;
    }

    let hoursLevelHtml;
    switch (hoursLevel) {
        case 0:
            hoursLevelHtml =
                '\t\t<div class="tooltiptext">Complete 1 more hour to reach Level 1 of Hours Milestones</div>';
            break;
        case 1:
            hoursLevelHtml = `\t\t<div class="tooltiptext">You're at Level 1 of Hours Milestones. Complete 30 hours to reach Level 2.</div>`;
            break;
        case 2:
            hoursLevelHtml = `\t\t<div class="tooltiptext">You're at Level 2 of Hours Milestones. Complete 60 hours to reach Level 3.</div>`;
            break;
        case 3:
            hoursLevelHtml = `\t\t<div class="tooltiptext">You're at Level 3 of Hours Milestones. Complete 90 hours to reach Level 4.</div>`;
            break;
        case 4:
            hoursLevelHtml = `\t\t<div class="tooltiptext">You're at Level 4 of Hours Milestones. Complete 120 hours to reach Level 5.</div>`;
            break;
        case 5:
            hoursLevelHtml = `\t\t<div class="tooltiptext">You're at Level 5 of Hours Milestones. Complete 200 hours to reach Level <span class="inf">∞</span>.</div>`;
            break;
        case 6:
            hoursLevelHtml = `\t\t<div class="tooltiptext">Congratulations, you're at Level <span class="inf">∞</span> of Hours Milestones!</div>`;
            break;
    }

    let streakLevelHtml;
    switch (longStreakLevel) {
        case 0:
            streakLevelHtml =
                '\t\t<div class="tooltiptext">Complete a 2 day streak to reach Level 1 of Streaks Milestones</div>';
            break;
        case 1:
            streakLevelHtml = `\t\t<div class="tooltiptext">You're at Level 1 of Streaks Milestones. Complete a 7 day streak to reach Level 2.</div>`;
            break;
        case 2:
            streakLevelHtml = `\t\t<div class="tooltiptext">You're at Level 2 of Streaks Milestones. Complete a 14 day streak to reach Level 3.</div>`;
            break;
        case 3:
            streakLevelHtml = `\t\t<div class="tooltiptext">You're at Level 3 of Streaks Milestones. Complete a 30 day streak to reach Level 4.</div>`;
            break;
        case 4:
            streakLevelHtml = `\t\t<div class="tooltiptext">You're at Level 4 of Streaks Milestones. Complete a 60 day streak to reach Level 5.</div>`;
            break;
        case 5:
            streakLevelHtml = `\t\t<div class="tooltiptext">You're at Level 5 of Streaks Milestones. Complete a 100 day streak to reach Level <span class="inf">∞</span>.</div>`;
            break;
        case 6:
            streakLevelHtml = `\t\t<div class="tooltiptext">Congratulations, you're at Level <span class="inf">∞</span> of Streaks Milestones!</div>`;
            break;
    }

    let milestoneLevelHtml;
    switch (milestoneLevel) {
        case 0:
            milestoneLevelHtml =
                '\t\t<div class="tooltiptext">Achieve 1 Milestone to reach Level 1 of Milestones</div>';
            break;
        case 1:
            milestoneLevelHtml = `\t\t<div class="tooltiptext">You're at Level 1 of Milestones. Achieve 10 Milestones to reach Level 2.</div>`;
            break;
        case 2:
            milestoneLevelHtml = `\t\t<div class="tooltiptext">You're at Level 2 of Milestones. Achieve 20 Milestones to reach Level 3.</div>`;
            break;
        case 3:
            milestoneLevelHtml = `\t\t<div class="tooltiptext">You're at Level 3 of Milestones. Achieve 30 Milestones to reach Level 4.</div>`;
            break;
        case 4:
            milestoneLevelHtml = `\t\t<div class="tooltiptext">You're at Level 4 of Milestones. Achieve 40 Milestones to reach Level 5.</div>`;
            break;
        case 5:
            milestoneLevelHtml = `\t\t<div class="tooltiptext">You're at Level 5 of Milestones. Achieve 50 Milestones to reach Level <span class="inf">∞</span>.</div>`;
            break;
        case 6:
            milestoneLevelHtml = `\t\t<div class="tooltiptext">Congratulations, you're at Level <span class="inf">∞</span> of Milestones!</div>`;
            break;
    }

    let avgHoursLevelHtml;
    switch (avgHoursLevel) {
        case 0:
            avgHoursLevelHtml =
                '\t\t<div class="tooltiptext">Achieve a 0.5 hour average to reach Level 1 of Average Hours</div>';
            break;
        case 1:
            avgHoursLevelHtml = `\t\t<div class="tooltiptext">You're at Level 1 of Average Hours. Achieve a 1.0 hour average to reach Level 2.</div>`;
            break;
        case 2:
            avgHoursLevelHtml = `\t\t<div class="tooltiptext">You're at Level 2 of Average Hours. Achieve a 1.5 hour average to reach Level 3.</div>`;
            break;
        case 3:
            avgHoursLevelHtml = `\t\t<div class="tooltiptext">You're at Level 3 of Average Hours. Achieve a 2.0 hour average to reach Level 4.</div>`;
            break;
        case 4:
            avgHoursLevelHtml = `\t\t<div class="tooltiptext">You're at Level 4 of Average Hours. Achieve a 2.5 hour average to reach Level 5.</div>`;
            break;
        case 5:
            avgHoursLevelHtml = `\t\t<div class="tooltiptext">You're at Level 5 of Average Hours. Achieve a 3.0 hour average to reach Level <span class="inf">∞</span>.</div>`;
            break;
        case 6:
            avgHoursLevelHtml = `\t\t<div class="tooltiptext">Congratulations, you're at Level <span class="inf">∞</span> of Average Hours!</div>`;
            break;
    }
    const shareText = [
        `100 Days Of Code Progress:`,
        `Days: ${days}`,
        `Total Hours: ${hours} hrs`,
        `Longest Streak: ${streaks} days`,
        `Milestones Earned: ${user.milestones}`,
        `Avg Hours/Day: ${avgHours} hrs\n`,
        `Data supplied from @software_hq’s 100 Days Of Code VScode plugin`
    ].join("\n");
    const shareURI = encodeURI(shareText);
    const twitterShareUrl = `https://twitter.com/intent/tweet?url=https%3A%2F%2Fwww.software.com%2F100-days-of-code&text=${shareURI}&hashtags=100DaysOfCode%2CSoftware%2CDeveloper`;

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
        if (codeTimeHours.length < 4) {
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
                    `\t\t\t\t<div class="chartDateText">${dayOne}/${monthOne}</div>`,
                    `\t\t\t\t<div class="chartDateText">${dayTwo}/${monthTwo}</div>`
                ].join("\n");
            } else {
                const dateObOne = new Date(datesFromLogs[0]);
                const dayOne = dateObOne.getDate();
                const monthOne = dateObOne.getMonth() + 1;
                xAxisDates = `\t\t\t\t<div class="chartDateText">${dayOne}/${monthOne}</div>`;
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
                `\t\t\t\t<div class="chartDateText">${dayOne}/${monthOne}</div>`,
                `\t\t\t\t<div class="chartDateText">${dayTwo}/${monthTwo}</div>`,
                `\t\t\t\t<div class="chartDateText">${dayThree}/${monthThree}</div>`
            ].join("\n");
        }
    }
    // no days
    if (barsHtml === "" || max === 0) {
        barsHtml = `<h2>Waiting for your Code Time data!</h2>`;
    }

    // Logs
    const logs = getLastSevenLoggedDays();
    let logsHtml = "";
    const monthNames = [
        "January",
        "February",
        "March",
        "April",
        "May",
        "June",
        "July",
        "August",
        "September",
        "October",
        "November",
        "December"
    ];

    const d = new Date();
    if (logs.length === 0) {
        logsHtml = `<h2 style="text-align: center; padding-top: 50px;">Excited for you to start your 1st day in #100DaysOfCode Challenge!<h2>`;
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

    // Milestones
    let milestoneHtml = "";
    if (user.recent_milestones.length > 0) {
        let count = 3;
        for (let i = 0; i < user.recent_milestones.length; i++) {
            const milestoneId = user.recent_milestones[i];
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
        milestoneHtml = `<h2 style="text-align: center; padding-top: 50px;">Excited for you to achieve your 1st Milestone!<h2>`;
    }

    let htmlString = [
        `<html>`,
        `<style>`,
        `\tbody {`,
        `\t\tfont-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen,`,
        `\t\t\tUbuntu, Cantarell, "Open Sans", "Helvetica Neue", sans-serif;`,
        `\t\twidth: 800px;`,
        `\t\tborder-radius: 3px;`,
        `\t\tborder-width: 2px;`,
        `\t\tborder-color: rgba(255, 255, 255, 0.05);`,
        `\t\tborder-style: solid;`,
        `\t\tmargin: 10px;`,
        `\t}\n`,
        `\th1 {`,
        `\t\tfont-size: 24px;`,
        `\t\tfont-weight: 600;`,
        `\t}\n`,
        `\t#head {`,
        `\t\tmargin-top: 15px;`,
        `\t}\n`,
        `\t.inline {`,
        `\t\tdisplay: inline;`,
        `\t}\n`,
        `\t#shareProgress {`,
        `\t\tfont-size: 16px;`,
        `\t\tline-height: 24px;`,
        `\t\tcolor: #ffffff;`,
        `\t\tfloat: right;`,
        `\t\tbackground-color: #00b4ee;`,
        `\t\tborder-color: #00b4ee;`,
        `\t\tborder-radius: 3px;`,
        `\t\tcursor: pointer;`,
        `\t}\n`,
        `\t#certificate {`,
        // `\t\tvisibility: hidden;`,
        `\t\tfont-size: 16px;`,
        `\t\tline-height: 24px;`,
        `\t\tpadding: 2px;`,
        `\t\twidth: 150px;`,
        `\t\tcolor: #ffffff;`,
        `\t\tfloat: right;`,
        `\t\tmargin-right: 10px;`,
        `\t\tborder-color: rgba(0, 0, 0, 0);`,
        `\t\tborder-radius: 3px;`,
        `\t\tcursor: pointer;`,
        `\t}\n`,
        `\t.level0 {`,
        `\t\tbackground: rgba(255, 255, 255, 0.05);`,
        `\t}\n`,
        `\t.level1 {`,
        `\t\tbackground: linear-gradient(180deg,`,
        `\t\t\t\trgba(251, 0, 0, 0.35) 0%,`,
        `\t\t\t\trgba(255, 151, 213, 0.35) 100%);`,
        `\t}\n`,
        `\t.level2 {`,
        `\t\tbackground: linear-gradient(180deg,`,
        `\t\t\t\trgba(255, 245, 0, 0.35) 0%,`,
        `\t\t\t\trgba(133, 250, 56, 0.35) 70.3%,`,
        `\t\t\t\trgba(0, 140, 39, 0.35) 100%);`,
        `\t}\n`,
        `\t.level3 {`,
        `\t\tbackground: linear-gradient(180deg,`,
        `\t\t\t\trgba(214, 126, 255, 0.35) 0%,`,
        `\t\t\t\trgba(86, 113, 255, 0.35) 67.71%,`,
        `\t\t\t\trgba(0, 224, 255, 0.35) 100%);`,
        `\t}\n`,
        `\t.level4 {`,
        `\t\tbackground: linear-gradient(180deg,`,
        `\t\t\t\trgba(255, 0, 0, 0.35) 2.05%,`,
        `\t\t\t\trgba(255, 168, 0, 0.35) 73.44%,`,
        `\t\t\t\trgba(255, 245, 0, 0.35) 100%);`,
        `\t}\n`,
        `\t.level5 {`,
        `\t\tbackground: linear-gradient(180deg,`,
        `\t\t\t\trgba(0, 224, 255, 0.35) 0%,`,
        `\t\t\t\trgba(219, 0, 255, 0.35) 49.6%,`,
        `\t\t\t\trgba(253, 106, 0, 0.35) 100%);`,
        `\t}\n`,
        `\t.level6 {`,
        `\t\tbackground: linear-gradient(180deg,`,
        `\t\t\t\trgba(219, 0, 255, 0.35) 3.41%,`,
        `\t\t\t\trgba(103, 115, 255, 0.35) 18.6%,`,
        `\t\t\t\trgba(13, 208, 255, 0.35) 32.96%,`,
        `\t\t\t\trgba(88, 213, 51, 0.35) 51.83%,`,
        `\t\t\t\trgba(255, 237, 1, 0.35) 75.22%,`,
        `\t\t\t\trgba(255, 97, 1, 0.35) 86.71%,`,
        `\t\t\t\trgba(255, 10, 1, 0.35) 100%);`,
        `\t}\n`,
        `\t#topMetrics {`,
        `\t\tdisplay: flex;`,
        `\t\tjustify-content: space-between;`,
        `\t\twidth: inherit;`,
        `\t\tmargin-top: 20px;`,
        `\t}\n`,
        `\t.metricsCard {`,
        `\t\tdisplay: inline-block;`,
        `\t\tborder-radius: 3px;`,
        `\t\twidth: 150px;`,
        `\t\theight: 90px;`,
        `\t}\n`,
        `\t.metricsHead {`,
        `\t\tpadding-top: 15px;`,
        `\t\tpadding-left: 10px;`,
        `\t\tfont-size: 21px;`,
        `\t\tfont-weight: 600;`,
        `\t}\n`,
        `\t.metricsBody {`,
        `\t\tpadding-top: 10px;`,
        `\t\tpadding-left: 10px;`,
        `\t\tpadding-right: 10px;`,
        `\t\tfont-size: 16px;`,
        `\t\tfont-weight: 400;`,
        `\t\tword-wrap: break-word;`,
        `\t}\n`,
        `\t#bigGrid {`,
        `\t\tdisplay: grid;`,
        `\t\tgrid-template-columns: 450px 350px;`,
        `\t}\n`,
        `\t#logs {`,
        `\t\tmargin-top: 10px;`,
        `\t\tpadding-left: 16px;`,
        `\t\tpadding-top: 5px;`,
        `\t\tpadding-right: 5px;`,
        `\t\twidth: 430px;`,
        `\t\tmin-height: 285px;`,
        `\t\tbackground-color: rgba(255, 255, 255, 0.05);`,
        `\t\tborder-radius: 3px;`,
        `\t}\n`,
        `\t#logTitle {`,
        `\t\tmargin-top: 5px;`,
        `\t\tdisplay: inline-block;`,
        `\t\tfont-size: 20px;`,
        `\t}\n`,
        `\t#viewLogs {`,
        `\t\tmargin-top: 5px;`,
        `\t\tmargin-right: 5px;`,
        `\t\tfloat: right;`,
        `\t\tfont-size: 14px;`,
        `\t\tline-height: 25px;`,
        `\t\tborder-radius: 3px;`,
        `\t\tborder-color: rgba(0, 0, 0, 0);`,
        `\t\tbackground-color: rgba(255, 255, 255, 0.05);`,
        `\t\tcolor: #ffffff;`,
        `\t\tcursor: pointer;`,
        `\t}\n`,
        `\t#logHeadings {`,
        `\t\tdisplay: grid;`,
        `\t\twidth: 435px;`,
        `\t\tmargin-left: -15px;`,
        `\t\tpadding-left: 15px;`,
        `\t\tgrid-template-columns: 50px 160px 220px;`,
        `\t\tfont-size: 16px;`,
        `\t\tline-height: 25px;`,
        `\t\tfont-weight: 400;`,
        `\t\tbackground-color: rgba(255, 255, 255, 0.05);`,
        `\t\tmargin-top: 15px;`,
        `\t\theight: 25px;`,
        `\t\tvertical-align: middle;`,
        `\t}\n`,
        `\t.logBody {`,
        `\t\tmargin-top: 10px;`,
        `\t\tdisplay: grid;`,
        `\t\tpadding: 2px;`,
        `\t\twidth: 100%;`,
        `\t\tgrid-template-columns: 50px 160px 220px;`,
        `\t\tfont-size: 16px;`,
        `\t\tword-wrap: break-word;`,
        `\t}\n`,
        `\t#chart {`,
        `\t\tposition: relative;`,
        `\t\twidth: 750px;`,
        `\t\theight: 325px;`,
        `\t\tborder-color: rgba(255, 255, 255, 0.05);`,
        `\t\tborder-width: 1px;`,
        `\t\tborder-style: solid;`,
        `\t\tborder-radius: 3px;`,
        `\t\tmargin-top: 20px;`,
        `\t\tmargin-bottom: 20px;`,
        `\t\tpadding: 20px;`,
        `\t}\n`,
        `\t#chartXMin {`,
        `\t\tposition: absolute;`,
        `\t\tbackground-color: #ffffff;`,
        `\t\twidth: 720px;`,
        `\t\theight: 2px;`,
        `\t\tbottom: 50px;`,
        `\t\tleft: 40px;`,
        `\t\tz-index: 1;`,
        `\t}\n`,
        `\t#chartXMid {`,
        `\t\tposition: absolute;`,
        `\t\tbackground-color: rgba(255, 255, 255, 0.05);`,
        `\t\twidth: 720px;`,
        `\t\theight: 1px;`,
        `\t\tbottom: 185px;`,
        `\t\tleft: 40px;`,
        `\t}\n`,
        `\t#chartXMax {`,
        `\t\tposition: absolute;`,
        `\t\tbackground-color: rgba(255, 255, 255, 0.05);`,
        `\t\twidth: 720px;`,
        `\t\theight: 1px;`,
        `\t\tbottom: 300px;`,
        `\t\tleft: 40px;`,
        `\t}\n`,
        `\t#chartTitle {`,
        `\t\ttext-align: center;`,
        `\t\tfont-size: 20px;`,
        `\t}\n`,
        `\t#chartBarContainer {`,
        `\t\twidth: 700px;`,
        `\t\theight: 250px;`,
        `\t\tposition: absolute;`,
        `\t\tdisplay: flex;`,
        `\t\tbottom: 50px;`,
        `\t\tleft: 60px;`,
        `\t\tjustify-content: space-around;`,
        `\t}\n`,
        `\t.chartBar {`,
        `\t\tposition: relative;`,
        `\t\tbackground-color: #00b4ee;`,
        `\t\tborder-top-left-radius: 5px;`,
        `\t\tborder-top-right-radius: 5px;`,
        `\t\twidth: 10%;`,
        `\t\theight: 10px;`,
        `\t\tmargin-left: 2px;`,
        `\t\tmargin-right: 2px;`,
        `\t\tbottom: 0px;`,
        `\t}\n`,
        `\t.chartYLabel {`,
        `\t\tposition: absolute;`,
        `\t\ttext-align: center;`,
        `\t\twidth: 40px;`,
        `\t\tleft: 0px;`,
        `\t}\n`,
        `\t#chartDateBar {`,
        `\t\tposition: absolute;`,
        `\t\tdisplay: inline-flex;`,
        `\t\twidth: 700px;`,
        `\t\tleft: 60px;`,
        `\t\tbottom: 20px;`,
        `\t\tjustify-content: ${dateJustifyContent};`,
        `\t}\n`,
        `\t.chartDateText {`,
        `\t\tfont-size: 12px;`,
        `\t}\n`,
        `\t/* milestones */`,
        `\t#milestones {`,
        `\t\tmargin-top: 10px;`,
        `\t\tmargin-left: 13px;`,
        `\t\tpadding-left: 16px;`,
        `\t\tpadding-top: 5px;`,
        `\t\tpadding-right: 5px;`,
        `\t\twidth: 315px;`,
        `\t\tmin-height: 285px;`,
        `\t\tbackground-color: rgba(255, 255, 255, 0.05);`,
        `\t\tborder-radius: 3px;`,
        `\t}\n`,
        `\t#milestoneTitle {`,
        `\t\tdisplay: inline-block;`,
        `\t\tmargin-top: 5px;`,
        `\t\tfont-size: 20px;`,
        `\t\tpadding-bottom: 5px;`,
        `\t}\n`,
        `\t#viewMilestones {`,
        `\t\tmargin-top: 5px;`,
        `\t\tmargin-right: 5px;`,
        `\t\tfloat: right;`,
        `\t\tfont-size: 14px;`,
        `\t\tline-height: 25px;`,
        `\t\tborder-radius: 3px;`,
        `\t\tborder-color: rgba(0, 0, 0, 0);`,
        `\t\tbackground-color: rgba(255, 255, 255, 0.05);`,
        `\t\tcolor: #ffffff;`,
        `\t\tcursor: pointer;`,
        `\t}\n`,
        `\t.milestoneCard {`,
        `\t\tmargin: 10px;`,
        `\t\tmargin-top: 20px;`,
        `\t\twidth: 270px;`,
        `\t\tdisplay: inline-block;`,
        `\t}\n`,
        `\t.logo {`,
        `\t\theight: 50px;`,
        `\t\twidth: 50px;`,
        `\t\tdisplay: inline-block;`,
        `\t}\n`,
        `\t.milestoneData {`,
        `\t\tdisplay: inline-block;`,
        `\t\twidth: 200px;`,
        `\t\theight: 50px;`,
        `\t\tvertical-align: top;`,
        `\t\tmargin-left: 10px;`,
        `\t}\n`,
        `\t.milestoneTitle {`,
        `\t\tfont-size: 16px;`,
        `\t\tline-height: 25px;`,
        `\t\tword-wrap: break-word;`,
        `\t}\n`,
        `\t.milestoneDesc {`,
        `\t\tfont-size: 14px;`,
        `\t\tline-height: 20px;`,
        `\t\tcolor: #919EAB;`,
        `\t\tword-wrap: break-word;\n`,
        `\t}`,
        `\t.metricsCard .tooltiptext {`,
        `\t\tposition: relative;`,
        `\t\tvisibility: hidden;`,
        `\t\twidth: 130px;`,
        `\t\tbottom: -20px;`,
        `\t\tleft: 5px;`,
        `\t\tborder-radius: 3px;`,
        `\t\tbackground-color: rgba(109, 109, 109, .9);`,
        `\t\tbackground-blend-mode: darken;`,
        `\t\tcolor: #fff;`,
        `\t\ttext-align: center;`,
        `\t\tpadding: 5px;`,
        `\t\tz-index: 1;`,
        `\t}`,
        `\t.metricsCard:hover .tooltiptext {`,
        `\t\tvisibility: visible;`,
        `\t}`,
        `\t.inf {`,
        `\t\tfont-size: larger;`,
        `\t}`,
        `</style>`,
        `\t<body>`,
        `\t<div id="head">`,
        `\t<h1 class="inline">100 Days of Code Dashboard</h1>`,
        `\t<a`,
        `\t\thref="${twitterShareUrl}"><button`,
        `\t\t\tid="shareProgress" title="Share dashboard metrics on Twitter">Share Progress</button></a>`,
        `\t<button id="certificate" class="level6">Get your Certificate</button>`,
        `\t</div>`,
        `\t<div id="topMetrics">`,
        `\t\t<div class="metricsCard level${daysLevel}">`,
        `\t\t<div class="metricsHead">${days}</div>`,
        `\t\t<div class="metricsBody">days complete</div>`,
        `${daysLevelHtml}`,
        `\t\t</div>\n`,
        `\t\t<div class="metricsCard level${hoursLevel}">`,
        `\t\t<div class="metricsHead">${hours}</div>`,
        `\t\t<div class="metricsBody">hours coded</div>`,
        `${hoursLevelHtml}`,
        `\t\t</div>\n`,
        `\t\t<div class="metricsCard level${longStreakLevel}">`,
        `\t\t<div class="metricsHead">${streaks}</div>`,
        `\t\t<div class="metricsBody">longest streaks</div>`,
        `${streakLevelHtml}`,
        `\t\t</div>\n`,
        `\t\t<div class="metricsCard level${milestoneLevel}">`,
        `\t\t<div class="metricsHead">${user.milestones}</div>`,
        `\t\t<div class="metricsBody">milestones earned</div>`,
        `${milestoneLevelHtml}`,
        `\t\t</div>\n`,
        `\t\t<div class="metricsCard level${avgHoursLevel}">`,
        `\t\t<div class="metricsHead">${avgHours}</div>`,
        `\t\t<div class="metricsBody">average hours/day</div>`,
        `${avgHoursLevelHtml}`,
        `\t\t</div>`,
        `\t</div>\n`,
        `\t<div id="bigGrid">`,
        `\t\t<div id="left">`,
        `\t\t<div id="logs">`,
        `\t\t\t<div id="logTitle">Logs</div>`,
        `\t\t\t<button id="viewLogs">View Logs</button>`,
        `\t\t\t<div id="logHeadings">`,
        `\t\t\t\t<span>Day</span>`,
        `\t\t\t\t<span>Date</span>`,
        `\t\t\t\t<span>Subject</span>`,
        `\t\t\t</div>`,
        `${logsHtml}`,
        `\t\t\t</div>`,
        `\t\t</div>\n`,
        `\t\t<div id="right">`,
        `\t\t\t<div id="milestones">`,
        `\t\t\t\t<div id="milestoneTitle">Recent Milestones</div>`,
        `\t\t\t\t<button id="viewMilestones">View Milestones</button>`,
        `${milestoneHtml}`,
        `\t\t</div>\n`,
        `\t</div>\n`,
        `\t\t<div id="chart">`,
        `\t\t\t<div id="chartTitle">Code Time: ${days} Days</div>`,
        `\t\t\t<div id="chartXMin"></div>`,
        `\t\t\t<div class="chartYLabel" style="bottom: 45px">${min} hr</div>`,
        `\t\t\t<div id="chartXMid"></div>`,
        `\t\t\t<div class="chartYLabel" style="bottom: 180px">${mid} hr</div>`,
        `\t\t\t<div id="chartXMax"></div>`,
        `\t\t\t<div class="chartYLabel" style="bottom: 295px">${max} hr</div>`,
        `\t\t\t<div id="chartBarContainer">`,
        `${barsHtml}`,
        `\t\t\t</div>`,
        `\t\t\t<div id="chartDateBar">`,
        `${xAxisDates}`,
        `\t\t\t</div>`,
        `\t\t</div>`,
        `\t\t</div>`,
        `\t</div>`,
        `\t</body>`,
        `\t<script>`,
        `\t\tconst vscode = acquireVsCodeApi();`,
        `\t\tconst milestonesButton = document.getElementById("viewMilestones");`,
        `\t\tconst logsButton = document.getElementById("viewLogs");`,
        `\t\tconst certificate = document.getElementById("certificate");`,
        `\t\tcertificate.addEventListener("click", function () {`,
        `\t\t\tvscode.postMessage({command: "Certificate"})`,
        `\t\t})`,
        `\t\tlogsButton.addEventListener("click", function(){`,
        `\t\t\tvscode.postMessage({command: "Logs"});`,
        `\t\t});`,
        `\t\tmilestonesButton.addEventListener("click", function(){`,
        `\t\t\tvscode.postMessage({command: "Milestones"});`,
        `\t\t});`,
        `\t</script>`,
        `</html>`
    ].join("\n");
    return htmlString;
}

export function updateDashboardHtml() {
    let filepath = getDashboardHtml();
    try {
        fs.writeFileSync(filepath, getUpdatedDashboardHtmlString());
    } catch (err) {
        console.log(err);
    }
}
