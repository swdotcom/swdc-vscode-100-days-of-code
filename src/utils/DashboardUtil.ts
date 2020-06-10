import { getSoftwareDir, isWindows } from "./Util";
import fs = require("fs");
import {
  getUserObject,
  getDaysLevel,
  getHoursLevel,
  getLongStreakLevel,
  getMilestonesEarnedLevel,
  getAverageHoursLevel,
} from "./UserUtil";
import { User } from "../models/User";
import {
  getLastSevenLoggedDays,
  getAllCodetimeHours,
  getLogDateRange,
} from "./LogsUtil";
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
  const avgHours = (user.hours / user.days).toFixed(2);
  const daysLevel = getDaysLevel(user.days);
  const hoursLevel = getHoursLevel(user.hours);
  const longStreakLevel = getLongStreakLevel(user.longest_streak);
  const milestoneLevel = getMilestonesEarnedLevel(user.milestones);
  const avgHoursLevel = getAverageHoursLevel(parseFloat(avgHours));
  const shareText = [
    `100 Days Of Code Progress:`,
    `Days: ${user.days}`,
    `Total Hours: ${user.hours} hrs`,
    `Longest Streak: ${user.longest_streak} days`,
    `Milestones Earned: ${user.milestones}`,
    `Avg Hours/Day: ${avgHours} hrs\n`,
    `Data supplied from @software_hq’s 100 Days Of Code VScode plugin`,
  ].join("\n");
  const shareURI = encodeURI(shareText);
  const twitterShareUrl = `https://twitter.com/intent/tweet?url=https%3A%2F%2Fwww.software.com&text=${shareURI}&hashtags=100DaysOfCode%2CSoftware%2CDeveloper`;

  // Datagram
  const codeTimeHours: Array<number> = getAllCodetimeHours();
  var max = 0;
  var mid = 0;
  const min = 0;
  var barsHtml = "";
  var dateJustifyContent = "space-between";
  var xAxisDates = "";
  if (codeTimeHours.length > 0) {
    max = Math.max(...codeTimeHours);
    mid = (max - min) / 2;
    for (var i = 0; i < codeTimeHours.length; i++) {
      var size = (codeTimeHours[i] * 200) / max;
      var transform = 200 - size;
      barsHtml += `\t\t\t\t<div class="chartBar" style="height: ${size}px; transform: translateY(${transform}px);"></div>`;
    }
    if (codeTimeHours.length < 4) {
      dateJustifyContent = "space-around";
    }
    var datesFromLogs = getLogDateRange();
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
          `\t\t\t\t<div class="chartDateText">${dayTwo}/${monthTwo}</div>`,
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
        `\t\t\t\t<div class="chartDateText">${dayThree}/${monthThree}</div>`,
      ].join("\n");
    }
  }
  // no days
  if (barsHtml === "") {
    barsHtml = `<h2>Waiting for your data!</h2>`;
  }

  // Logs
  const logs = getLastSevenLoggedDays();
  var logsHtml = "";
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
    "December",
  ];

  const d = new Date();
  if (logs.length === 0) {
    logsHtml = `<h2 style="text-align: center; padding-top: 50px;">Excited for you to start your 1st day in #100DaysOfCode Challenge!<h2>`;
  } else {
    for (var i = 0; i < logs.length; i++) {
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
  var milestoneHtml = "";
  if (user.recent_milestones.length > 0) {
    var count = 5;
    for (var i = 0; i < user.recent_milestones.length; i++) {
      const milestoneId = user.recent_milestones[i];
      const milestone = getMilestoneById(milestoneId);
      const shareLink = milestoneShareUrlGenerator(
        milestone.id,
        milestone.title,
        milestone.description
      );
      const dateOb = new Date(milestone.date_achieved);
      const day = dateOb.getDate();
      const month = dateOb.getMonth() + 1;
      const year = dateOb.getFullYear();
      milestoneHtml += [
        `\t\t<div class="milestoneCard">`,
        `\t\t\t<div class="level${milestone.level} milestoneCardLevel">Level 2</div>`,
        `\t\t\t<a href="${shareLink}"`,
        `\t\t\t><img`,
        `\t\t\t\tsrc="https://100-days-of-code.s3-us-west-1.amazonaws.com/Milestones/share.svg"`,
        `\t\t\t\tclass="milestoneShare"`,
        `\t\t\t/></a>`,
        `\t\t\t<div class="milestoneTitle">${milestone.title}</div>`,
        `\t\t\t<img class="logo"`,
        `\t\t\tsrc="${milestone.icon}"`,
        `\t\t\talt="Connect internet to view this really cool logo!">`,
        `\t\t\t<div class="milestoneDesc">${milestone.description}</div>`,
        `\t\t\t<div class="date">${day}/${month}/${year}</div>`,
        `\t\t</div>`,
      ].join("\n");
      count -= 1;
      if (count === 0) {
        break;
      }
    }
    for (var i = 0; i < count; i++) {
      milestoneHtml += `\t\t<div class="milestoneCard"></div>\n`;
    }
    milestoneHtml += [
      `\t\t<div id="goToMilestones" class="nextCard">`,
      `\t\t\t<a href="Milestones"> <img`,
      `\t\t\t\tclass="arrow"`,
      `\t\t\t\tsrc="https://100-days-of-code.s3-us-west-1.amazonaws.com/Dashboard/arrow.svg"`,
      `\t\t\t\t/></a>`,
      `\t\t</div>`,
    ].join("\n");
  } else {
    milestoneHtml = [
      `\t\t<div class="milestoneCard"></div>`,
      `\t\t<div class="milestoneCard"></div>`,
      `\t\t<div class="milestoneCard"></div>`,
      `\t\t<div class="milestoneCard"></div>`,
      `\t\t<div class="milestoneCard"></div>`,
      `\t\t<div id="goToMilestones" class="nextCard">`,
      `\t\t\t<a href="Milestones"> <img`,
      `\t\t\t\tclass="arrow"`,
      `\t\t\t\tsrc="https://100-days-of-code.s3-us-west-1.amazonaws.com/Dashboard/arrow.svg"`,
      `\t\t\t\t/></a>`,
      `\t\t</div>`,
    ].join("\n");
  }

  let htmlString = [
    `<html>`,
    `\t<style>`,
    `\tbody {`,
    `\t\tfont-family: sans-serif;`,
    `\t\twidth: 1200px;`,
    `\t\tborder-radius: 5px;`,
    `\t\tborder-width: 2px;`,
    `\t\tborder-color: #444444;`,
    `\t\tborder-style: solid;`,
    `\t\tmargin: 10px;`,
    `\t}`,
    `\th1 {`,
    `\t\tfont-size: 32px;`,
    `\t\tfont-weight: 600;`,
    `\t}`,
    `\th2 {`,
    `\t\tfont-size: 24px;`,
    `\t\tfont-weight: 600;`,
    `\t}\n`,
    `\t#progress {`,
    `\t\tdisplay: inline;`,
    `\t}`,
    `\t#shareProgress {`,
    `\t\tfont-size: 24px;`,
    `\t\tcolor: #ffffff;`,
    `\t\tfloat: right;`,
    `\t\tbackground-color: #024e68;`,
    `\t\tborder-color: #00b4ee;`,
    `\t\tborder-radius: 5px;`,
    `\t}\n`,
    `\t.level0{`,
    `\t\tbackground: #333333;`,
    `\t}`,
    `\t.level1 {`,
    `\t\tbackground: linear-gradient(`,
    `\t\t180deg,`,
    `\t\trgba(251, 0, 0, 0.35) 0%,`,
    `\t\trgba(255, 151, 213, 0.35) 100%`,
    `\t\t);`,
    `\t}`,
    `\t.level2 {`,
    `\t\tbackground: linear-gradient(`,
    `\t\t180deg,`,
    `\t\trgba(255, 245, 0, 0.35) 0%,`,
    `\t\trgba(133, 250, 56, 0.35) 70.3%,`,
    `\t\trgba(0, 140, 39, 0.35) 100%`,
    `\t\t);`,
    `\t}`,
    `\t.level3 {`,
    `\t\tbackground: linear-gradient(`,
    `\t\t180deg,`,
    `\t\trgba(214, 126, 255, 0.35) 0%,`,
    `\t\trgba(86, 113, 255, 0.35) 67.71%,`,
    `\t\trgba(0, 224, 255, 0.35) 100%`,
    `\t\t);`,
    `\t}`,
    `\t.level4 {`,
    `\t\tbackground: linear-gradient(`,
    `\t\t180deg,`,
    `\t\trgba(255, 0, 0, 0.35) 2.05%,`,
    `\t\trgba(255, 168, 0, 0.35) 73.44%,`,
    `\t\trgba(255, 245, 0, 0.35) 100%`,
    `\t\t);`,
    `\t}`,
    `\t.level5 {`,
    `\t\tbackground: linear-gradient(`,
    `\t\t180deg,`,
    `\t\trgba(0, 224, 255, 0.35) 0%,`,
    `\t\trgba(219, 0, 255, 0.35) 49.6%,`,
    `\t\trgba(253, 106, 0, 0.35) 100%`,
    `\t\t);`,
    `\t}`,
    `\t.level6 {`,
    `\t\tbackground: linear-gradient(`,
    `\t\t180deg,`,
    `\t\trgba(219, 0, 255, 0.35) 3.41%,`,
    `\t\trgba(103, 115, 255, 0.35) 18.6%,`,
    `\t\trgba(13, 208, 255, 0.35) 32.96%,`,
    `\t\trgba(88, 213, 51, 0.35) 51.83%,`,
    `\t\trgba(255, 237, 1, 0.35) 75.22%,`,
    `\t\trgba(255, 97, 1, 0.35) 86.71%,`,
    `\t\trgba(255, 10, 1, 0.35) 100%`,
    `\t\t);`,
    `\t}\n`,
    `\t#topMetrics {`,
    `\t\tdisplay: flex;`,
    `\t\tjustify-content: space-between;`,
    `\t\twidth: inherit;`,
    `\t\tmargin-top: 20px;`,
    `\t}`,
    `\t.metricsCard {`,
    `\t\tdisplay: inline-block;`,
    `\t\tborder-radius: 5px;`,
    `\t\twidth: 200px;`,
    `\t\theight: 90px;`,
    `\t}`,
    `\t.metricsHead {`,
    `\t\tpadding-top: 15px;`,
    `\t\tpadding-left: 10px;`,
    `\t\tfont-size: 24px;`,
    `\t\tfont-weight: 600;`,
    `\t}`,
    `\t.metricsBody {`,
    `\t\tpadding-top: 10px;`,
    `\t\tpadding-left: 10px;`,
    `\t\tfont-size: 18px;`,
    `\t\tfont-weight: 100;`,
    `\t}\n`,
    `\t#bigGrid {`,
    `\t\tdisplay: grid;`,
    `\t\tgrid-template-columns: repeat(2, 600px);`,
    `\t}`,
    `\t#logs {`,
    `\t\tmargin-top: 20px;`,
    `\t\tpadding: 5px;`,
    `\t\twidth: 580px;`,
    `\t\tmin-height: 300px;`,
    `\t\tbackground-color: #333333;`,
    `\t\tborder-radius: 5px;`,
    `\t}`,
    `\t#logTitle {`,
    `\t\tdisplay: inline;`,
    `\t\tfont-size: 24px;`,
    `\t\tfont-weight: 600;`,
    `\t\tpadding-bottom: 5px;`,
    `\t}`,
    `\t#goToLogs {`,
    `\t\tfloat: right;`,
    `\t\tfont-size: 16px;`,
    `\t\tfont-weight: 600;`,
    `\t\tborder-radius: 5px;`,
    `\t\tbackground-color: #024e68;`,
    `\t\tborder-color: #00b4ee;`,
    `\t\tcolor: #ffffff;`,
    `\t}`,
    `\t#logHeadings {`,
    `\t\tdisplay: grid;`,
    `\t\tpadding: 2px;`,
    `\t\twidth: 570px;`,
    `\t\tgrid-template-columns: 50px 170px 340px;`,
    `\t\tfont-size: 18px;`,
    `\t\tfont-weight: 600;`,
    `\t\tborder-width: 1px;`,
    `\t\tborder-style: solid;`,
    `\t\tborder-radius: 5px;`,
    `\t\tborder-color: #6d767e;`,
    `\t}`,
    `\t.logBody {`,
    `\t\tmargin-top: 10px;`,
    `\t\tdisplay: grid;`,
    `\t\tpadding: 2px;`,
    `\t\twidth: 640px;`,
    `\t\tgrid-template-columns: 50px 170px 340px;`,
    `\t\tfont-size: 18px;`,
    `\t\tword-wrap: break-word;`,
    `\t}`,
    `\t.share {`,
    `\t\twidth: 10px;`,
    `\t}`,
    `\t#tips {`,
    `\t\tmargin-top: 15px;`,
    `\t\tdisplay: grid;`,
    `\t\tgrid-template-columns: 40px 600px;`,
    `\t\twidth: 640px;`,
    `\t}`,
    `\t#tipsIcon {`,
    `\t\theight: 35px;`,
    `\t}`,
    `\t#tipData {`,
    `\t\tfont-size: 18px;`,
    `\t\tmargin-left: 5px;`,
    `\t}`,
    `\t#chart {`,
    `\t\tposition: relative;`,
    `\t\twidth: 540px;`,
    `\t\theight: 325px;`,
    `\t\t/* background-color: #333333; */`,
    `\t\tborder-color: #444444;`,
    `\t\tborder-width: 1px;`,
    `\t\tborder-style: solid;`,
    `\t\tborder-radius: 5px;`,
    `\t\tmargin-top: 20px;`,
    `\t\tmargin-left: 20px;`,
    `\t\tpadding: 20px;`,
    `\t}`,
    `\t#chartXMin {`,
    `\t\tposition: absolute;`,
    `\t\tbackground-color: #ffffff;`,
    `\t\twidth: 500px;`,
    `\t\theight: 2px;`,
    `\t\tbottom: 50px;`,
    `\t\tleft: 40px;`,
    `\t\tz-index: 1;`,
    `\t}`,
    `\t#chartXMid {`,
    `\t\tposition: absolute;`,
    `\t\tbackground-color: #444444;`,
    `\t\twidth: 500px;`,
    `\t\theight: 1px;`,
    `\t\tbottom: 150px;`,
    `\t\tleft: 40px;`,
    `\t}`,
    `\t#chartXMax {`,
    `\t\tposition: absolute;`,
    `\t\tbackground-color: #444444;`,
    `\t\twidth: 500px;`,
    `\t\theight: 1px;`,
    `\t\tbottom: 250px;`,
    `\t\tleft: 40px;`,
    `\t}`,
    `\t#chartTitle{`,
    `\t\tposition: flex;`,
    `\t\twidth: 100%;`,
    `\t\ttext-align: center;`,
    `\t\tfont-size: 36px;`,
    `\t}`,
    `\t#chartBarContainer{`,
    `\t\t/* background-color: purple; */`,
    `\t\twidth: 460px;`,
    `\t\theight: 200px;`,
    `\t\tposition: absolute;`,
    `\t\tdisplay: flex;`,
    `\t\tbottom: 50px;`,
    `\t\tleft: 60px;`,
    `\t\tjustify-content: space-around;`,
    `\t}`,
    `\t.chartBar {`,
    `\t\tposition: relative;`,
    `\t\tbackground-color: #00b4ee;`,
    `\t\tborder-top-left-radius: 5px;`,
    `\t\tborder-top-right-radius: 5px;`,
    `\t\twidth:100%;`,
    `\t\theight: 10px;`,
    `\t\tmargin-left: 2px;`,
    `\t\tmargin-right: 2px;`,
    `\t\tbottom: 0px;`,
    `\t}`,
    `\t.chartYLabel{`,
    `\t\tposition: absolute;`,
    `\t\ttext-align: center;`,
    `\t\twidth: 40px;`,
    `\t\tleft: 0px;`,
    `\t}`,
    `\t#chartDateBar{`,
    `\t\tposition: absolute;`,
    `\t\tdisplay: inline-flex;`,
    `\t\twidth: 460px;`,
    `\t\tleft: 60px;`,
    `\t\tbottom: 20px;`,
    `\t\tjustify-content: ${dateJustifyContent};`,
    `\t}`,
    `\t.chartDateText{`,
    `\t\tfont-size: 12px;`,
    `\t}\n`,
    `\t/* Milestone card */`,
    `\t#milestones {`,
    `\t\tpadding-top: 0px;`,
    `\t}`,
    `\t#innerMilestones {`,
    `\t\tdisplay: flex;`,
    `\t\tjustify-content: space-between;`,
    `\t\twidth: inherit;`,
    `\t}`,
    `\t.milestoneCard {`,
    `\t\tbackground-color: #333333;`,
    `\t\tdisplay: inline-block;`,
    `\t\tmargin: 10px;`,
    `\t\tposition: relative;`,
    `\t\theight: 235px;`,
    `\t\twidth: 200px;`,
    `\t\tborder-radius: 10px;`,
    `\t}`,
    `\t.milestoneShare {`,
    `\t\tposition: absolute;`,
    `\t\tright: 10px;`,
    `\t\ttop: 10px;`,
    `\t\theight: auto;`,
    `\t\twidth: 10px;`,
    `\t}`,
    `\t.milestoneCardLevel {`,
    `\t\tposition: absolute;`,
    `\t\twidth: 50px;`,
    `\t\theight: 18px;`,
    `\t\tleft: 7px;`,
    `\t\ttop: 7px;`,
    `\t\tline-height: 18px;`,
    `\t\tfont-size: 12px;`,
    `\t\tfont-weight: 250;`,
    `\t\tborder-radius: 3px;`,
    `\t\ttext-align: center;`,
    `\t\tvertical-align: middle;`,
    `\t}`,
    `\t.milestoneTitle {`,
    `\t\tposition: absolute;`,
    `\t\ttop: 27px;`,
    `\t\ttext-align: center;`,
    `\t\twidth: inherit;`,
    `\t\tfont-size: large;`,
    `\t\tfont-weight: 350;`,
    `\t}`,
    `\t.logo {`,
    `\t\theight: 100px;`,
    `\t\twidth: 100px;`,
    `\t\tposition: absolute;`,
    `\t\ttop: 60px;`,
    `\t\tleft: 50px;`,
    `\t}`,
    `\t.milestoneDesc {`,
    `\t\tposition: absolute;`,
    `\t\twidth: inherit;`,
    `\t\ttext-align: center;`,
    `\t\tfont-size: 14px;`,
    `\t\tbottom: 40px;`,
    `\t}`,
    `\t.date {`,
    `\t\tposition: absolute;`,
    `\t\twidth: inherit;`,
    `\t\ttext-align: center;`,
    `\t\tfont-size: 14px;`,
    `\t\tfont-weight: 350;`,
    `\t\tbottom: 10px;`,
    `\t\tcolor: #919eab;`,
    `\t}`,
    `\t.nextCard {`,
    `\t\tbackground-color: #024e68;`,
    `\t\tborder-color: #00b4ee;`,
    `\t\tdisplay: inline-block;`,
    `\t\tmargin: 10px;`,
    `\t\tposition: relative;`,
    `\t\theight: 235px;`,
    `\t\twidth: 100px;`,
    `\t\tborder-radius: 10px;`,
    `\t\tborder-style: solid;`,
    `\t\tborder-width: 1px;`,
    `\t}`,
    `\t.arrow {`,
    `\t\twidth: 90px;`,
    `\t\tposition: absolute;`,
    `\t\ttop: 70px;`,
    `\t\tleft: 5px;`,
    `\t}`,
    `\t</style>`,
    `\t<body>`,
    `\t<h1>100 Days of Code Dasboard</h1>\n`,
    `\t<div>`,
    `\t\t<h2 id="progress">Progress</h2>`,
    `\t\t<a href="${twitterShareUrl}"><button id="shareProgress">Share Progress</button></a>`,
    `\t</div>\n`,
    `\t<div id="topMetrics">`,
    `\t\t<div class="metricsCard level${daysLevel}">`,
    `\t\t<div class="metricsHead">${user.days}</div>`,
    `\t\t<div class="metricsBody">days complete</div>`,
    `\t\t</div>\n`,
    `\t\t<div class="metricsCard level${hoursLevel}">`,
    `\t\t<div class="metricsHead">${user.hours}</div>`,
    `\t\t<div class="metricsBody">hours coded</div>`,
    `\t\t</div>\n`,
    `\t\t<div class="metricsCard level${longStreakLevel}">`,
    `\t\t<div class="metricsHead">${user.longest_streak}</div>`,
    `\t\t<div class="metricsBody">longest streak (days)</div>`,
    `\t\t</div>\n`,
    `\t\t<div class="metricsCard level${milestoneLevel}">`,
    `\t\t<div class="metricsHead">${user.milestones}</div>`,
    `\t\t<div class="metricsBody">milestones earned</div>`,
    `\t\t</div>\n`,
    `\t\t<div class="metricsCard level${avgHoursLevel}">`,
    `\t\t<div class="metricsHead">${avgHours}</div>`,
    `\t\t<div class="metricsBody">average hours/day</div>`,
    `\t\t</div>`,
    `\t</div>\n`,
    `\t<div id="bigGrid">`,
    `\t\t<div id="left">`,
    `\t\t<div id="logs">`,
    `\t\t\t<div id="logTitle">Logs</div>`,
    `\t\t\t<button id="goToLogs">Go to Logs</button>`,
    `\t\t\t<div id="logHeadings">`,
    `\t\t\t<span>Day</span>`,
    `\t\t\t<span>Date</span>`,
    `\t\t\t<span>Subject</span>`,
    `\t\t\t</div>`,
    `\t\t\t<div>`,
    `${logsHtml}`,
    `\t\t\t</div>`,
    `\t\t</div>\n`,
    `\t\t<div id="tips">`,
    `\t\t\t<img`,
    `\t\t\tsrc="https://100-days-of-code.s3-us-west-1.amazonaws.com/Dashboard/tips.svg"`,
    `\t\t\tid="tipsIcon"`,
    `\t\t\t/>`,
    `\t\t\t<div id="tipData">`,
    `\t\t\t<b>Tip:</b> Create a todo list for your goals during 100 Days Of`,
    `\t\t\tCode.`,
    `\t\t\t<br />`,
    `\t\t\tMore like this on`,
    `\t\t\t<a href="https://www.software.com">Software.com</a>`,
    `\t\t\t</div>`,
    `\t\t</div>`,
    `\t\t</div>\n`,
    `\t\t<div id="right">`,
    `\t\t<div id="chart">`,
    `\t\t\t<div id="chartTitle">Code Time: ${codeTimeHours.length} Days</div>`,
    `\t\t\t<div id="chartXMin"></div>`,
    `\t\t\t<div class="chartYLabel" style="bottom: 45px">${min} hr</div>`,
    `\t\t\t<div id="chartXMid"></div>`,
    `\t\t\t<div class="chartYLabel" style="bottom: 145px">${mid} hr</div>`,
    `\t\t\t<div id="chartXMax"></div>`,
    `\t\t\t<div class="chartYLabel" style="bottom: 245px">${max} hr</div>`,
    `\t\t\t<div id="chartBarContainer">`,
    `${barsHtml}`,
    `\t\t\t</div>`,
    `\t\t\t<div id="chartDateBar">`,
    `${xAxisDates}`,
    `\t\t\t</div>`,
    `\t\t</div>`,
    `\t\t</div>`,
    `\t</div>\n`,
    `\t<div id="milestones">`,
    `\t\t<h2>Milestones</h2>`,
    `\t\t<div id="innerMilestones">`,
    `${milestoneHtml}`,
    `\t\t</div>`,
    `\t</div>`,
    `\t</body>`,
    `\t<script>`,
    `\t\tconst vscode = acquireVsCodeApi();`,
    `\t\tconst milestonesButton = document.getElementById("goToMilestones");`,
    `\t\tconst logsButton = document.getElementById("goToLogs");`,
    `\t\tlogsButton.addEventListener("click", function(){`,
    `\t\t\tvscode.postMessage({command: "Logs"});`,
    `\t\t});`,
    `\t\tmilestonesButton.addEventListener("click", function(){`,
    `\t\t\tvscode.postMessage({command: "Milestones"});`,
    `\t\t});`,
    `\t</script>`,
    `</html>`,
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
