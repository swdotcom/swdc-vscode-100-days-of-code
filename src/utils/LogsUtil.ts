import { getSoftwareDir, isWindows } from "./Util";
import fs = require("fs");
import { CodetimeMetrics } from "../models/CodetimeMetrics";
import { Log } from "../models/Log";
import { checkMilestonesJson, getMilestoneById } from "./MilestonesUtil";
import { getSessionCodetimeMetrics } from "./MetricUtil";
import { getUserObject, checkUserJson } from "./UserUtil";

export function getLogsJson() {
  let file = getSoftwareDir();
  if (isWindows()) {
    file += "\\logs.json";
  } else {
    file += "/logs.json";
  }
  return file;
}

export function checkLogsJson() {
  const filepath = getLogsJson();
  try {
    if (fs.existsSync(filepath)) {
      return true;
    } else {
      fs.writeFileSync(filepath, '{"logs": []}');
      return true;
    }
  } catch (err) {
    return false;
  }
}

function checkIfDateExists() {
  const exists = checkLogsJson();
  if (exists) {
    const dateNow = new Date();
    const filepath = getLogsJson();
    let rawLogs = fs.readFileSync(filepath).toString();
    let logs = JSON.parse(rawLogs).logs;

    for (var i = logs.length - 1; i >= 0; i--) {
      const dateOb = new Date(logs[i].date);
      // Older date
      if (dateNow.valueOf > dateOb.valueOf) {
        return false;
      }

      // Checking if date exists
      if (
        dateNow.getDate() === dateOb.getDate() &&
        dateNow.getMonth() === dateOb.getMonth() &&
        dateNow.getFullYear() === dateOb.getFullYear()
      ) {
        return true;
      }
    }

    // If no logs exist
    return false;
  }
}

export function addLogToJson(
  title: string,
  description: string,
  hours: string,
  keystrokes: string,
  lines: string,
  links: Array<string>
) {
  const exists = checkLogsJson();
  if (!exists) {
    console.log("error accessing json");
    return false;
  }
  const dayNum = getLatestLogEntryNumber() + 1;

  // this would usually never be triggered
  if (dayNum === 0) {
    console.log("Day already exists");
    return false;
  }

  const filepath = getLogsJson();
  let rawLogs = fs.readFileSync(filepath).toString();
  let logs = JSON.parse(rawLogs);

  var codetimeMetrics = new CodetimeMetrics();

  codetimeMetrics.hours = parseFloat(hours);
  codetimeMetrics.lines_added = parseInt(lines);
  codetimeMetrics.keystrokes = parseInt(keystrokes);

  const log = new Log();
  log.title = title;
  log.description = description;
  log.links = links;
  log.date = Date.now();
  log.codetime_metrics = codetimeMetrics;
  log.day_number = dayNum;
  // if date exists, we need to edit log not create one
  const dateExists = checkIfDateExists();
  if (dateExists) {
    return updateLogByDate(log);
  }

  logs.logs.push(log);
  try {
    fs.writeFileSync(filepath, JSON.stringify(logs, null, 4));
  } catch (err) {
    console.log(err);
    return false;
  }
  return true;
}

export function getLatestLogEntryNumber() {
  const exists = checkLogsJson();
  if (exists) {
    const dateNow = new Date();
    const filepath = getLogsJson();
    let rawLogs = fs.readFileSync(filepath).toString();
    let logs = JSON.parse(rawLogs).logs;

    for (var i = logs.length - 1; i >= 0; i--) {
      if (logs[i].day_number) {
        const dateOb = new Date(logs[i].date);
        if (
          dateNow.getDate() === dateOb.getDate() &&
          dateNow.getMonth() === dateOb.getMonth() &&
          dateNow.getFullYear() === dateOb.getFullYear()
        ) {
          return -1;
        }
        return logs[i].day_number;
      }
    }
    return 0;
  }
}

export function getMostRecentLogObject() {
  const exists = checkLogsJson();
  if (exists) {
    const logFilepath = getLogsJson();
    let rawLogs = fs.readFileSync(logFilepath).toString();
    let logs = JSON.parse(rawLogs).logs;

    return logs[logs.length - 1].codetime_metrics;
  }
}

export function getLogDateRange(): Array<number> {
  const exists = checkLogsJson();
  if (exists) {
    const filepath = getLogsJson();
    let rawLogs = fs.readFileSync(filepath).toString();
    let logs = JSON.parse(rawLogs).logs;
    var dates = [];
    dates.push(logs[0].date);
    dates.push(logs[logs.length - 1].date);
    return dates;
  } else {
    var dates = new Array(2);
    return dates;
  }
}

export function getAllCodetimeHours(): Array<number> {
  const exists = checkLogsJson();
  if (exists) {
    const filepath = getLogsJson();
    let rawLogs = fs.readFileSync(filepath).toString();
    let logs = JSON.parse(rawLogs).logs;

    let sendHours: Array<number> = [];
    for (var i = 0; i < logs.length; i++) {
      if (logs[i].day_number) {
        sendHours.push(logs[i].codetime_metrics.hours);
      }
    }
    return sendHours;
  }
  return [];
}

export function getLastSevenLoggedDays(): Array<Log> {
  const exists = checkLogsJson();
  if (exists) {
    const filepath = getLogsJson();
    let rawLogs = fs.readFileSync(filepath).toString();
    let logs = JSON.parse(rawLogs).logs;

    let sendLogs = [];
    for (var i = logs.length - 1; i >= 0; i--) {
      if (logs[i].day_number) {
        sendLogs.push(logs[i]);
        if (sendLogs.length === 7) {
          return sendLogs;
        }
      }
    }
    return sendLogs;
  }
  return [];
}

export function updateLogByDate(log: Log) {
  const exists = checkLogsJson();
  if (exists) {
    const logDate = new Date(log.date);
    const filepath = getLogsJson();
    let rawLogs = fs.readFileSync(filepath).toString();
    let logs = JSON.parse(rawLogs).logs;

    const dateExists = checkIfDateExists();
    if (!dateExists) {
      addLogToJson(
        log.title,
        log.description,
        log.codetime_metrics.hours.toString(),
        log.codetime_metrics.keystrokes.toString(),
        log.codetime_metrics.lines_added.toString(),
        log.links
      );
      return;
    }

    for (var i = logs.length - 1; i >= 0; i--) {
      const dateOb = new Date(logs[i].date);

      // Checking if date matches
      if (
        logDate.getDate() === dateOb.getDate() &&
        logDate.getMonth() === dateOb.getMonth() &&
        logDate.getFullYear() === dateOb.getFullYear()
      ) {
        logs[i].title = log.title;
        logs[i].description = log.description;
        logs[i].links = log.links;
        logs[i].date = log.date;
        logs[i].codetime_metrics = log.codetime_metrics;
        logs[i].day_number = log.day_number;
        const sendLogs = { logs };

        try {
          fs.writeFileSync(filepath, JSON.stringify(sendLogs, null, 4));
          console.log("Json File Updated");
        } catch (err) {
          console.log(err);
          return false;
        }
        return true;
      }
    }
  }
}

export function editLogEntry(
  dayNumber: number,
  title: string,
  description: string,
  links: Array<string>
) {
  const exists = checkLogsJson();
  if (exists) {
    const filepath = getLogsJson();
    const rawLogs = fs.readFileSync(filepath).toString();
    let logs = JSON.parse(rawLogs).logs;
    for (var i = 0; i < logs.length; i++) {
      let log = logs[i];
      if (log.day_number !== dayNumber) {
        continue;
      }
      log.title = title;
      log.description = description;
      log.links = links;
      break;
    }
    const sendLogs = { logs };
    try {
      fs.writeFileSync(filepath, JSON.stringify(sendLogs, null, 4));
      console.log("Json File Updated");
    } catch (err) {
      console.log(err);
      return false;
    }
  }
}

export function updateLogsMilestonesAndMetrics(milestones: Array<number>) {
  const exists = checkLogsJson();
  if (exists) {
    const metrics: Array<number> = getSessionCodetimeMetrics();
    // metrics of form [minutes, keystrokes, lines]
    if (metrics === []) {
      console.log("error fetching metrics");
      return;
    }
    const logDate = new Date();
    const filepath = getLogsJson();
    let rawLogs = fs.readFileSync(filepath).toString();
    let logs = JSON.parse(rawLogs).logs;

    // if date doesn't exist, create a log with just milestones and a date
    const dateExists = checkIfDateExists();
    if (!dateExists) {
      var log = new Log();
      log.date = logDate.valueOf();
      log.milestones = milestones;
      log.codetime_metrics.hours = parseFloat((metrics[0] / 60).toFixed(1));
      log.codetime_metrics.keystrokes = metrics[1];
      log.codetime_metrics.lines_added = metrics[2];
      logs.push(log);
      const sendLogs = { logs };

      try {
        fs.writeFileSync(filepath, JSON.stringify(sendLogs, null, 4));
        console.log("Json File Updated");
      } catch (err) {
        console.log(err);
        return false;
      }
      return true;
    }

    // date exists
    for (var i = logs.length - 1; i >= 0; i--) {
      const dateOb = new Date(logs[i].date);
      // Checking if date matches
      if (
        logDate.getDate() === dateOb.getDate() &&
        logDate.getMonth() === dateOb.getMonth() &&
        logDate.getFullYear() === dateOb.getFullYear()
      ) {
        if (!logs[i].day_number) {
          logs[i].codetime_metrics.hours = parseFloat(
            (metrics[0] / 60).toFixed(1)
          );
          logs[i].codetime_metrics.keystrokes = metrics[1];
          logs[i].codetime_metrics.lines_added = metrics[2];
        }
        logs[i].milestones = logs[i].milestones.concat(milestones);
        const sendLogs = { logs };

        try {
          fs.writeFileSync(filepath, JSON.stringify(sendLogs, null, 4));
          console.log("Json File Updated");
        } catch (err) {
          console.log(err);
          return false;
        }
        return true;
      }
    }
  }
}

export function getLogsHtml() {
  let file = getSoftwareDir();
  if (isWindows()) {
    file += "\\logs.html";
  } else {
    file += "/logs.html";
  }
  return file;
}

export function getUpdatedLogsHtmlString() {
  const logsExists = checkLogsJson();
  const milestonesExists = checkMilestonesJson();
  const userExists = checkUserJson();
  if (logsExists && milestonesExists && userExists) {
    const logFilepath = getLogsJson();
    let rawLogs = fs.readFileSync(logFilepath).toString();
    let logs = JSON.parse(rawLogs).logs;

    let htmlString = [
      `<html>`,
      `<head>`,
      `\t<title>`,
      `\t\tLogs`,
      `\t</title>`,
      `</head>`,
      `<style>`,
      `\t.logCard {`,
      `\t\tdisplay: inline-block;`,
      `\t\tfont-family: sans-serif;`,
      `\t\tbackground: #333333;`,
      `\t\tborder-width: 3px;`,
      `\t\tborder-style: solid;`,
      `\t\tborder-color: #555555;`,
      `\t\tbox-sizing: border-box;`,
      `\t\tborder-radius: 5px;`,
      `\t\tpadding: 8px;`,
      `\t\tpadding-left: 10px;`,
      `\t}`,
      `\t.cardText {`,
      `\t\tfont-style: normal;`,
      `\t\tfont-weight: normal;`,
      `\t\tfont-size: 14px;`,
      `\t\tline-height: 128.91%;`,
      `\t\tdisplay: flex;`,
      `\t\tpadding-left: 10px;`,
      `\t\talign-items: center;`,
      `\t\tcolor: #FFFFFF;`,
      `\t\tvisibility: visible;`,
      `\t}`,
      `\t.cardTextEditInput {`,
      `\t\tposition: absolute;`,
      `\t\ttop: 0px;`,
      `\t\ttransform: translate(8px, 30px);`,
      `\t\tvisibility: hidden;`,
      `\t}`,
      `\t.cardSubject {`,
      `\t\tfont-style: normal;`,
      `\t\tfont-weight: bold;`,
      `\t\tfont-size: 16px;`,
      `\t\tline-height: 128.91%;`,
      `\t\tdisplay: flex;`,
      `\t\tcolor: #FFFFFF;`,
      `\t\tmargin-bottom: 12px;`,
      `\t}`,
      `\t.cardTextGroup {`,
      `\t\tposition: relative;`,
      `\t\tvertical-align: top;`,
      `\t}`,
      `\t.cardHeader {`,
      `\t\tposition: relative;`,
      `\t\twidth: 100%;`,
      `\t\theight: 100px;`,
      `\t\tdisplay: inline-flex;`,
      `\t}`,
      `\t.cardHeaderTextSection {`,
      `\t\t/* background-color: red; */`,
      `\t\tposition: absolute;`,
      `\t\tleft: 0px;`,
      `\t}`,
      `\t.cardHeaderButtonSection {`,
      `\t\t/* background-color: blue; */`,
      `\t\tposition: absolute;`,
      `\t\tdisplay: inline-flex;`,
      `\t\theight: 100%;`,
      `\t\tright: 3px;`,
      `\t\tvertical-align: middle;`,
      `\t\talign-items: center;`,
      `\t}`,
      `\t.cardHeaderEditLogButton {`,
      `\t\tcursor: pointer;`,
      `\t\tfont-style: normal;`,
      `\t\tfont-weight: bold;`,
      `\t\tfont-size: 18px;`,
      `\t\ttext-align: center;`,
      `\t\tcolor: #FFFFFF;`,
      `\t\tbackground-color: #444444;`,
      `\t\tborder-radius: 5px;`,
      `\t\tborder-color: #666666;`,
      `\t\tpadding: 5px;`,
      `\t\tvertical-align: middle;`,
      `\t\tvisibility: hidden;`,
      `\t\tmargin: 5px;`,
      `\t}`,
      `\t.cardHeaderEditLogSubmit {`,
      `\t\tcursor: pointer;`,
      `\t\tposition: absolute;`,
      `\t\tfont-style: normal;`,
      `\t\tfont-weight: bold;`,
      `\t\tfont-size: 18px;`,
      `\t\ttext-align: center;`,
      `\t\tcolor: #FFFFFF;`,
      `\t\tbackground-color: #00b4ee;`,
      `\t\tborder-radius: 5px;`,
      `\t\tborder-color: #0491c0;`,
      `\t\tpadding: 5px;`,
      `\t\tvertical-align: middle;`,
      `\t\tvisibility: hidden;`,
      `\t\ttransform: translate(-60px, -5px);`,
      `\t\tmargin: 5px;`,
      `\t}`,
      `\t.cardHeaderEditLogCancel {`,
      `\t\tcursor: pointer;`,
      `\t\tposition: absolute;`,
      `\t\tfont-style: normal;`,
      `\t\tfont-weight: bold;`,
      `\t\tfont-size: 18px;`,
      `\t\ttext-align: center;`,
      `\t\tcolor: #FFFFFF;`,
      `\t\tbackground-color: #F3AB3C;`,
      `\t\tborder-radius: 5px;`,
      `\t\tborder-color: #c98d33;`,
      `\t\tpadding: 5px;`,
      `\t\tvertical-align: middle;`,
      `\t\tvisibility: hidden;`,
      `\t\ttransform: translate(60px, -5px);`,
      `\t\tmargin: 5px;`,
      `\t}`,
      `\t.cardHeaderShareButton {`,
      `\t\tcursor: pointer;`,
      `\t\tposition: absolute;`,
      `\t\tbackground-color: rgba(0,0,0,0);`,
      `\t\tborder-color: rgba(0,0,0,0);`,
      `\t\ttransform: translate(50px, -20px);`,
      `\t\tmargin: 5px;`,
      `\t}`,
      `\t.cardHeaderShareButtonIcon {`,
      `\t\twidth: 25px;`,
      `\t\theight: 25px;`,
      `\t}`,
      `\t.cardHeaderDropDownButton {`,
      `\t\tcursor: pointer;`,
      `\t\tbackground-color: rgba(0,0,0,0);`,
      `\t\tborder-color: rgba(0,0,0,0);`,
      `\t\ttransform: rotate(180deg);`,
      `\t\tmargin: 5px;`,
      `\t}`,
      `\tbutton:focus {outline:0;}`,
      `\t.cardContent {`,
      `\t\tmax-height: 0;`,
      `\t\toverflow: hidden;`,
      `\t\ttransition: max-height 0.2s ease-out;`,
      `\t}`,
      `\t.cardTextSection {`,
      `\t\twidth: 400px;`,
      `\t\tdisplay: inline-block;`,
      `\t\tvertical-align: top;`,
      `\t}`,
      `\t.cardMetricsSection {`,
      `\t\t/* background-color: red; */`,
      `\t\tdisplay: inline-block;`,
      `\t\tvertical-align: top;`,
      `\t}`,
      `\t.cardMetricsTitle {`,
      `\t\twidth: 100%;`,
      `\t\tfont-style: normal;`,
      `\t\tfont-weight: bold;`,
      `\t\tfont-size: 16px;`,
      `\t\tline-height: 128.91%;`,
      `\t\ttext-align: center;`,
      `\t\tcolor: #FFFFFF;`,
      `\t\tmargin-bottom: 3px;`,
      `\t}`,
      `\t.cardMetricGrid {`,
      `\t\twidth: 600px;`,
      `\t\tjustify-content: space-around;`,
      `\t\tdisplay: flex;`,
      `\t}`,
      `\t.cardMetric {`,
      `\t\twidth: 30%;`,
      `\t\tdisplay: inline-flex;`,
      `\t\talign-items: center;`,
      `\t\tbackground: #444444;`,
      `\t\tborder-radius: 3px;`,
      `\t\tdisplay: flex;`,
      `\t\tflex-direction: column;`,
      `\t\tjustify-content: space-around;`,
      `\t\tpadding-top: 15px;`,
      `\t\tpadding-bottom: 15px;`,
      `\t}`,
      `\t.cardMetricText {`,
      `\t\t/* background-color: darkgreen; */`,
      `\t\twidth: 100%;`,
      `\t\tfont-style: normal;`,
      `\t\tfont-weight: bold;`,
      `\t\tfont-size: 12px;`,
      `\t\tline-height: 128.91%;`,
      `\t\ttext-align: center;`,
      `\t\tcolor: #FFFFFF;`,
      `\t}`,
      `\t.cardMetricBarGroup{`,
      `\t\tposition: relative;`,
      `\t\twidth: 120px;`,
      `\t\theight: 40px;`,
      `\t}`,
      `\t.cardMetricBarLeft{`,
      `\t\tposition: absolute;`,
      `\t\twidth: 10px;`,
      `\t\theight: 40px;`,
      `\t\ttop: 0px;`,
      `\t\tleft: 0px;`,
      `\t\tborder-radius: 2px;`,
      `\t\tbackground-color: #777777;`,
      `\t}`,
      `\t.cardMetricBarRight{`,
      `\t\tposition: absolute;`,
      `\t\twidth: 10px;`,
      `\t\theight: 40px;`,
      `\t\ttop: 0px;`,
      `\t\tleft: 110px;`,
      `\t\tborder-radius: 2px;`,
      `\t\tbackground-color: #777777;`,
      `\t}`,
      `\t.cardMetricBarMiddle{`,
      `\t\tposition: absolute;`,
      `\t\twidth: 100px;`,
      `\t\theight: 20px;`,
      `\t\ttop: 10px;`,
      `\t\tleft: 10px;`,
      `\t\tbackground-color: #555555;`,
      `\t}`,
      `\t.cardMilestoneSection {`,
      `\t\tdisplay: inline-block;`,
      `\t\tvertical-align: top;`,
      `\t\twidth: 200px;`,
      `\t\theight: 230px;`,
      `\t}`,
      `\t.cardMilestoneTitle {`,
      `\t\twidth: 200px;`,
      `\t\tfont-style: normal;`,
      `\t\tfont-weight: bold;`,
      `\t\tfont-size: 16px;`,
      `\t\tline-height: 128.91%;`,
      `\t\ttext-align: center;`,
      `\t\tcolor: #FFFFFF;`,
      `\t}`,
      `\t.cardMilestoneGrid {`,
      `\t\twidth: 200px;`,
      `\t\theight: 200px;`,
      `\t\tdisplay: flex;`,
      `\t\tflex-direction: column;`,
      `\t\tjustify-content: space-around;`,
      `\t}`,
      `\t.cardMilestoneRow {`,
      `\t\twidth: 100%;`,
      `\t\tjustify-content: space-around;`,
      `\t\tdisplay: flex;`,
      `\t}`,
      `\t.cardMilestone {`,
      `\t\tposition: relative;`,
      `\t\twidth: 55px;`,
      `\t\theight: 55px;`,
      `\t\tbackground: #444444;`,
      `\t\tborder-radius: 3px;`,
      `\t\tdisplay: inline-flex;`,
      `\t\talign-items: center;`,
      `\t}`,
      `\t.cardMilestoneIcon{`,
      `\t\twidth: 35px;`,
      `\t\theight: 35px;`,
      `\t\tposition: absolute;`,
      `\t\ttop: 50%;`,
      `\t\tleft: 50%;`,
      `\t\ttransform: translate(-50%, -50%);`,
      `\t}`,
      `\t.cardMilestone .tooltiptext {`,
      `\t\tvisibility: hidden;`,
      `\t\ttop: 8px;`,
      `\t\tright: 105%;`,
      `\t\tbackground-color: rgba(109, 109, 109, .8);`,
      `\t\tborder-color: rgba(255, 255, 255, 1);`,
      `\t\tborder-style: solid;`,
      `\t\tborder-width: 1px;`,
      `\t\tborder-radius: 6px;`,
      `\t\tbackground-blend-mode: darken;`,
      `\t\tcolor: #fff;`,
      `\t\ttext-align: center;`,
      `\t\twhite-space: nowrap;`,
      `\t\tpadding: 5px;`,
      `\t\tposition: absolute;`,
      `\t\tz-index: 1;`,
      `\t}`,
      `\t.cardMilestone:hover .tooltiptext {`,
      `\t\tvisibility: visible;`,
      `\t}`,
      `</style>`,
      `<body>`,
      `\t<h1>Logs</h1>\n`,
    ].join("\n");

    if (logs.length < 1 || (logs.length === 1 && !logs[0].day_number)) {
      htmlString += [
        `\t\t<h2 id='noLogs'>Log Daily Progress to see it here! --> <a id="addLog" href="Add Log">Add log</a></h2></body>`,
        `\t<script>\n\tconst vscode = acquireVsCodeApi();`,
        `\tconst addLog = document.getElementById("addLog");`,
        `\tif(addLog){`,
        `\t\taddLog.addEventListener("click", function(){`,
        `\t\t\tvscode.postMessage({command: "addLog"});`,
        `\t\t});}\n\t</script>\n</html>`,
      ].join("\n");
    } else {
      let mostRecentLog = logs[logs.length - 1];
      let LogDate = new Date(mostRecentLog.date);
      let todaysDate = new Date();

      if (
        LogDate.getDate() !== todaysDate.getDate() ||
        LogDate.getMonth() !== todaysDate.getMonth() ||
        LogDate.getFullYear() !== todaysDate.getFullYear()
      ) {
        htmlString += `\t\t<h2>Don't forget to submit your log today! --> <a id="addLog" href="Add Log">Add log</a></h2>\n`;
      }

      for (var i = logs.length - 1; i >= 0; i--) {
        const day = logs[i];

        if (!day.day_number) {
          continue;
        }

        var shareText = [
          `Day ${day.day_number}/100 of 100DaysOfCode`,
          `What I worked on: ${day.title}`,
          `Metrics: Hours: ${day.codetime_metrics.hours}, Lines of Code: ${day.codetime_metrics.lines_added}, Keystrokes: ${day.codetime_metrics.keystrokes}`,
          `Data supplied from @software_hq’s 100 Days Of Code VScode plugin`,
        ].join("\n");
        const shareURI = encodeURI(shareText);
        const twitterShareUrl = `https://twitter.com/intent/tweet?url=https%3A%2F%2Fwww.software.com&text=${shareURI}&hashtags=100DaysOfCode%2CSoftware%2CDeveloper`;

        const unix_timestamp = day.date;

        //Getting the date
        const date = new Date(unix_timestamp);
        const dayOfMonth = date.getDate();
        const month = date.getMonth() + 1;
        const year = date.getFullYear();
        const formattedTime = month + "/" + dayOfMonth + "/" + year;

        var descriptionRows = day.description === "" ? 2 : 3;

        htmlString += [
          `\t<h2>Day ${day.day_number}</h2>`,
          `\t<div class="logCard">`,
          `\t\t<div class="cardHeader">`,
          `\t\t\t<div class="cardHeaderTextSection">`,
          `\t\t\t\t<div class="cardSubject">${formattedTime}</div>`,
          `\t\t\t\t<div class="cardTextGroup">`,
          `\t\t\t\t\t<div class="cardSubject">Title:</div>`,
          `\t\t\t\t\t<div class="cardText">${day.title}</div>`,
          `\t\t\t\t\t<textarea class="cardTextEditInput" rows="1" cols="70">${day.title}</textarea>`,
          `\t\t\t\t\t<br>`,
          `\t\t\t\t</div>`,
          `\t\t\t</div>`,
          `\t\t\t<div class="cardHeaderButtonSection">`,
          `\t\t\t\t<button class="cardHeaderEditLogSubmit">Submit Log</button>`,
          `\t\t\t\t<button class="cardHeaderEditLogCancel">Cancel</button>`,
          `\t\t\t\t<a href="${twitterShareUrl}"><button class="cardHeaderShareButton"><img class="cardHeaderShareButtonIcon" src="https://100-days-of-code.s3-us-west-1.amazonaws.com/Milestones/share.svg"></button></a>`,
          `\t\t\t\t<button class="cardHeaderEditLogButton">Edit Log</button>`,
          `\t\t\t\t<button class="cardHeaderDropDownButton"><img class="cardHeaderShareButtonIcon" src="https://100-days-of-code.s3-us-west-1.amazonaws.com/Logs/dropDown.svg"></button>`,
          `\t\t\t</div>`,
          `\t\t</div>`,
          `\t\t<div class="cardContent">`,
          `\t\t\t<div class="cardTextSection">`,
          `\t\t\t\t<div class="cardTextGroup">`,
          `\t\t\t\t\t<div class="cardSubject">Subject:</div>`,
          `\t\t\t\t\t<div class="cardText">${day.description}</div>`,
          `\t\t\t\t\t<textarea class="cardTextEditInput" rows="${descriptionRows}" cols="70">${day.description}</textarea>`,
          `\t\t\t\t\t<br><br>`,
          `\t\t\t\t</div>`,
          `\t\t\t\t<div class="cardTextGroup">`,
          `\t\t\t\t\t<div class="cardSubject">Links:</div>`,
          `\t\t\t\t\t<div>\n`,
        ].join("\n");

        let linksText = "";
        for (var _j = 0; _j < day.links.length; _j++) {
          htmlString += [
            `\t\t\t\t\t\t<a class="cardText" href="${day.links[_j]}">`,
            `\t\t\t\t\t\t\t<div>${day.links[_j]}</div>`,
            `\t\t\t\t\t\t</a>\n`,
          ].join("\n");
          linksText += day.links[_j] + ", ";
        }

        const user = getUserObject();
        const avgHours = user.hours / user.days;
        const avgKeystrokes = user.keystrokes / user.days;
        const avgLines = user.lines_added / user.days;

        let percentHours = (day.codetime_metrics.hours / avgHours) * 100;
        percentHours = Math.round(percentHours * 100) / 100;
        let percentKeystrokes =
          (day.codetime_metrics.keystrokes / avgKeystrokes) * 100;
        percentKeystrokes = Math.round(percentKeystrokes * 100) / 100;
        let percentLines = (day.codetime_metrics.lines_added / avgLines) * 100;
        percentLines = Math.round(percentLines * 100) / 100;

        let barPxHours = Math.round(percentHours);
        let barColorHours = "00b4ee";
        if (barPxHours >= 100) {
          barPxHours = 100;
          barColorHours = "FD9808";
        }
        let barPxKeystrokes = Math.round(percentKeystrokes);
        let barColorKeystrokes = "00b4ee";
        if (barPxKeystrokes >= 100) {
          barPxKeystrokes = 100;
          barColorKeystrokes = "FD9808";
        }
        let barPxLines = Math.round(percentLines);
        let barColorLines = "00b4ee";
        if (barPxLines >= 100) {
          barPxLines = 100;
          barColorLines = "FD9808";
        }

        htmlString += [
          `\t\t\t\t\t</div>`,
          `\t\t\t\t\t<textarea class="cardTextEditInput" rows="3" cols="70">${linksText}</textarea>`,
          `\t\t\t\t</div>`,
          `\t\t\t</div>`,
          `\t\t\t<div class="cardMetricsSection">`,
          `\t\t\t\t<div class="cardMetricsTitle">Coding Metrics</div>`,
          `\t\t\t\t<br>`,
          `\t\t\t\t<div class='cardMetricGrid'>`,
          `\t\t\t\t\t<div class="cardMetric">`,
          `\t\t\t\t\t\t<div class="cardMetricText" style="font-size: 20px; margin-bottom: 5px;">${day.codetime_metrics.hours}</div>`,
          `\t\t\t\t\t\t<div class="cardMetricText" style="font-size: 16px; margin-bottom: 20px;">Active Code Time</div>`,
          `\t\t\t\t\t\t<div class="cardMetricText" style="font-size: 12px; margin-bottom: 5px;">${percentHours}% of Average</div>`,
          `\t\t\t\t\t\t<div class="cardMetricText" style="font-size: 12px; margin-bottom: 20px;">Average: ${avgHours} Hours</div>`,
          `\t\t\t\t\t\t<div class="cardMetricBarGroup">`,
          `\t\t\t\t\t\t\t<div class="cardMetricBarRight"></div>`,
          `\t\t\t\t\t\t\t<div class="cardMetricBarMiddle"></div>`,
          `\t\t\t\t\t\t\t<div class="cardMetricBarMiddle" style="width: ${barPxHours}px; background-color: #${barColorHours};"></div>`,
          `\t\t\t\t\t\t\t<div class="cardMetricBarLeft"></div>`,
          `\t\t\t\t\t\t</div>`,
          `\t\t\t\t\t</div>`,
          `\t\t\t\t\t<div class="cardMetric">`,
          `\t\t\t\t\t\t<div class="cardMetricText" style="font-size: 20px; margin-bottom: 5px;">${day.codetime_metrics.keystrokes}</div>`,
          `\t\t\t\t\t\t<div class="cardMetricText" style="font-size: 16px; margin-bottom: 20px;">Keystrokes</div>`,
          `\t\t\t\t\t\t<div class="cardMetricText" style="font-size: 12px; margin-bottom: 5px;">${percentKeystrokes}% of Average</div>`,
          `\t\t\t\t\t\t<div class="cardMetricText" style="font-size: 12px; margin-bottom: 20px;">Average: ${avgKeystrokes}</div>`,
          `\t\t\t\t\t\t<div class="cardMetricBarGroup">`,
          `\t\t\t\t\t\t\t<div class="cardMetricBarRight"></div>`,
          `\t\t\t\t\t\t\t<div class="cardMetricBarMiddle"></div>`,
          `\t\t\t\t\t\t\t<div class="cardMetricBarMiddle" style="width: ${barPxKeystrokes}px; background-color: #${barColorKeystrokes};"></div>`,
          `\t\t\t\t\t\t\t<div class="cardMetricBarLeft"></div>`,
          `\t\t\t\t\t\t</div>`,
          `\t\t\t\t\t</div>`,
          `\t\t\t\t\t<div class="cardMetric">`,
          `\t\t\t\t\t\t<div class="cardMetricText" style="font-size: 20px; margin-bottom: 5px;">${day.codetime_metrics.lines_added}</div>`,
          `\t\t\t\t\t\t<div class="cardMetricText" style="font-size: 16px; margin-bottom: 20px;">Lines Added</div>`,
          `\t\t\t\t\t\t<div class="cardMetricText" style="font-size: 12px; margin-bottom: 5px;">${percentLines}% of Average</div>`,
          `\t\t\t\t\t\t<div class="cardMetricText" style="font-size: 12px; margin-bottom: 20px;">Average: ${avgLines}</div>`,
          `\t\t\t\t\t\t<div class="cardMetricBarGroup">`,
          `\t\t\t\t\t\t\t<div class="cardMetricBarRight"></div>`,
          `\t\t\t\t\t\t\t<div class="cardMetricBarMiddle"></div>`,
          `\t\t\t\t\t\t\t<div class="cardMetricBarMiddle" style="width: ${barPxLines}px; background-color: #${barColorLines};"></div>`,
          `\t\t\t\t\t\t\t<div class="cardMetricBarLeft"></div>`,
          `\t\t\t\t\t\t</div>`,
          `\t\t\t\t\t</div>`,
          `\t\t\t\t</div>`,
          `\t\t\t</div>`,
          `\t\t\t<div class="cardMilestoneSection">`,
          `\t\t\t\t<div class="cardMilestoneTitle">Milestones</div>`,
          `\t\t\t\t<br>`,
          `\t\t\t\t<div class="cardMilestoneGrid">\n`,
        ].join("\n");

        const milestoneNum = day.milestones.length;
        for (var milestoneIndex = 0; milestoneIndex < 9; milestoneIndex++) {
          if (milestoneIndex % 3 === 0) {
            htmlString += `\t\t\t\t\t<div class="cardMilestoneRow">\n`;
          }

          if (milestoneIndex < milestoneNum) {
            let milestoneId = day.milestones[milestoneIndex];
            let milestone = getMilestoneById(milestoneId);
            htmlString += [
              `\t\t\t\t\t\t<div class="cardMilestone">`,
              `\t\t\t\t\t\t\t<span class="tooltiptext">`,
              `\t\t\t\t\t\t\t\t<div style="font-weight: bold;">${milestone.title}</div>`,
              `\t\t\t\t\t\t\t\t<div>${milestone.description}</div>`,
              `\t\t\t\t\t\t\t</span>`,
              `\t\t\t\t\t\t\t<img class="cardMilestoneIcon" src="${milestone.icon}" alt="">`,
              `\t\t\t\t\t\t</div>\n`,
            ].join("\n");
          } else {
            htmlString += [
              `\t\t\t\t\t\t<div class="cardMilestone">`,
              `\t\t\t\t\t\t</div>\n`,
            ].join("\n");
          }

          if (milestoneIndex % 3 === 2) {
            htmlString += `\t\t\t\t\t</div>\n`;
          }
        }

        htmlString += [
          `\t\t\t\t\t</div>`,
          `\t\t\t\t</div>`,
          `\t\t\t</div>`,
          `\t\t</div>`,
          `\t</div>\n`,
        ].join("\n");
      }

      htmlString += [
        `</body>`,
        `<script>`,
        `\tconst vscode = acquireVsCodeApi();`,
        `\tvar dropDownButtons = document.getElementsByClassName("cardHeaderDropDownButton");\n`,
        `\tconst addLog = document.getElementById("addLog");`,
        `\tif(addLog){`,
        `\t\taddLog.addEventListener("click", function(){`,
        `\t\t\tvscode.postMessage({command: "addLog"});`,
        `\t\t});}\n`,
        `\tfor (var i = 0; i < dropDownButtons.length; i++) {`,
        `\t\tdropDownButtons[i].addEventListener("click", function () {`,
        `\t\t\tvar shareButton = this.parentNode.getElementsByClassName("cardHeaderShareButton")[0];`,
        `\t\t\tvar editButton = this.parentNode.getElementsByClassName("cardHeaderEditLogButton")[0];`,
        `\t\t\tvar dropDownIcon = this;`,
        `\t\t\tvar content = this.parentNode.parentNode.nextElementSibling;`,
        `\t\t\tif (content.style.maxHeight) {`,
        `\t\t\t\tcontent.style.maxHeight = null;`,
        `\t\t\t\tdropDownIcon.style.transform = 'rotate(180deg)';`,
        `\t\t\t\teditButton.style.visibility = 'hidden';`,
        `\t\t\t\tshareButton.style.transform = 'translate(50px, -20px)'`,
        `\t\t\t} else {`,
        `\t\t\t\tcontent.style.maxHeight = content.scrollHeight + "px";`,
        `\t\t\t\tdropDownIcon.style.transform = 'rotate(0deg)';`,
        `\t\t\t\teditButton.style.visibility = 'visible';`,
        `\t\t\t\tshareButton.style.transform = 'translate(-48px, -20px)'`,
        `\t\t\t}`,
        `\t\t});`,
        `\t}`,
        `\tvar editButtons = document.getElementsByClassName("cardHeaderEditLogButton");`,
        `\t`,
        `\tfor (var i = 0; i < editButtons.length; i++) {`,
        `\t\teditButtons[i].addEventListener("click", function () {`,
        `\t\t\t`,
        `\t\t\tvar shareButton = this.parentNode.getElementsByClassName("cardHeaderShareButton")[0];`,
        `\t\t\tvar submitButton = this.parentNode.getElementsByClassName("cardHeaderEditLogSubmit")[0];`,
        `\t\t\tvar cancelButton = this.parentNode.getElementsByClassName("cardHeaderEditLogCancel")[0];`,
        `\t\t\tvar editButton = this.parentNode.getElementsByClassName("cardHeaderEditLogButton")[0];`,
        `\t\t\tvar dropDownButton = this.parentNode.getElementsByClassName("cardHeaderDropDownButton")[0];`,
        `\t\t\tvar textFields = this.parentNode.parentNode.parentNode.getElementsByClassName("cardTextEditInput")`,
        `\t\t\tvar textLabels = this.parentNode.parentNode.parentNode.getElementsByClassName("cardText");`,
        `\t\t\t`,
        `\t\t\tsubmitButton.style.visibility = 'visible';`,
        `\t\t\tcancelButton.style.visibility = 'visible';`,
        `\t\t\tshareButton.style.visibility = 'hidden';`,
        `\t\t\teditButton.style.visibility = 'hidden';`,
        `\t\t\tdropDownButton.style.visibility = 'hidden';`,
        `\t\t\tfor(let textLabel of textLabels){`,
        `\t\t\t\ttextLabel.style.visibility = "hidden";`,
        `\t\t\t\ttextLabel.style.maxHeight = null;`,
        `\t\t\t}`,
        `\t\t\tfor(let textField of textFields){`,
        `\t\t\t\ttextField.style.visibility = "visible";`,
        `\t\t\t\ttextField.style.maxHeight = textField.scrollHeight + "px";`,
        `\t\t\t}`,
        `\t\t    `,
        `\t\t});`,
        `\t}`,
        `\tvar cancelButtons = document.getElementsByClassName("cardHeaderEditLogCancel");`,
        `\t`,
        `\tfor (var i = 0; i < cancelButtons.length; i++) {`,
        `\t\tcancelButtons[i].addEventListener("click", function () {`,
        `\t\t\tvar shareButton = this.parentNode.getElementsByClassName("cardHeaderShareButton")[0];`,
        `\t\t\tvar submitButton = this.parentNode.getElementsByClassName("cardHeaderEditLogSubmit")[0];`,
        `\t\t\tvar cancelButton = this.parentNode.getElementsByClassName("cardHeaderEditLogCancel")[0];`,
        `\t\t\tvar editButton = this.parentNode.getElementsByClassName("cardHeaderEditLogButton")[0];`,
        `\t\t\tvar dropDownButton = this.parentNode.getElementsByClassName("cardHeaderDropDownButton")[0];`,
        `\t\t\tvar textFields = this.parentNode.parentNode.parentNode.getElementsByClassName("cardTextEditInput");`,
        `\t\t\tvar textLabels = this.parentNode.parentNode.parentNode.getElementsByClassName("cardText");`,
        `\t\t\tsubmitButton.style.visibility = 'hidden';`,
        `\t\t\tcancelButton.style.visibility = 'hidden';`,
        `\t\t\tshareButton.style.visibility = 'visible';`,
        `\t\t\teditButton.style.visibility = 'visible';`,
        `\t\t\tdropDownButton.style.visibility = 'visible';`,
        `\t\t\tfor(let textLabel of textLabels){`,
        `\t\t\t\ttextLabel.style.visibility = "visible";`,
        `\t\t\t\ttextLabel.style.maxHeight = textLabel.scrollHeight + "px";`,
        `\t\t\t}`,
        `\t\t\tfor(let textField of textFields){`,
        `\t\t\t\ttextField.style.visibility = "hidden";`,
        `\t\t\t\ttextField.style.maxHeight = null;`,
        `\t\t\t}`,
        `\t\t});`,
        `\t}`,
        `\tvar submitButtons = document.getElementsByClassName("cardHeaderEditLogSubmit");`,
        `\t`,
        `\tfor (var i = 0; i < submitButtons.length; i++) {`,
        `\t\tsubmitButtons[i].addEventListener("click", function () {`,
        `\t\t\tvar shareButton = this.parentNode.getElementsByClassName("cardHeaderShareButton")[0];`,
        `\t\t\tvar submitButton = this.parentNode.getElementsByClassName("cardHeaderEditLogSubmit")[0];`,
        `\t\t\tvar cancelButton = this.parentNode.getElementsByClassName("cardHeaderEditLogCancel")[0];`,
        `\t\t\tvar editButton = this.parentNode.getElementsByClassName("cardHeaderEditLogButton")[0];`,
        `\t\t\tvar dropDownButton = this.parentNode.getElementsByClassName("cardHeaderDropDownButton")[0];`,
        `\t\t\tvar textFields = this.parentNode.parentNode.parentNode.getElementsByClassName("cardTextEditInput");`,
        `\t\t\tvar textLabels = this.parentNode.parentNode.parentNode.getElementsByClassName("cardText");`,
        `\t\t\t`,
        `\t\t\tlet dayNumber = this.parentNode.parentNode.parentNode.previousElementSibling.innerHTML.split(" ")[1];`,
        `\t\t\tlet title = textFields[0].value;`,
        `\t\t\tlet description = textFields[1].value;`,
        `\t\t\tlet links = textFields[2].value;`,
        `\t\t\ttextLabels[0].innerHTML = title;`,
        `\t\t\ttextLabels[1].innerHTML = description;`,
        `\t\t\tlet linksRoot = textLabels[2].parentNode;`,
        `\t\t\tlet allOldLinks = linksRoot.childNodes;`,
        `\t\t\tfor(var _j = allOldLinks.length-1; _j >= 0; _j--){`,
        `\t\t\t    allOldLinks[_j].remove();`,
        `\t\t\t}`,
        `\t\t\t`,
        `\t\t\tlet linksList = links.replace(" ", "").split(",");`,
        `\t\t\tif(linksList.length > 0){`,
        `\t\t\t\tfor(var _j = 0; _j < linksList.length; _j++){`,
        `\t\t\t\t\tlet link = linksList[_j];`,
        `\t\t\t\t\tvar a = document.createElement("a");`,
        `\t\t\t\t\ta.className = "cardText";`,
        `\t\t\t\t\ta.href = link;`,
        `\t\t\t\t\tvar div = document.createElement("div");`,
        `\t\t\t\t\tvar text = document.createTextNode(link);`,
        `\t\t\t\t\ta.append(div);`,
        `\t\t\t\t\tdiv.append(text);`,
        `\t\t\t\t\tlinksRoot.append(a);`,
        `\t\t\t\t}`,
        `\t\t\t}else{`,
        `\t\t\t\tvar a = document.createElement("a");`,
        `\t\t\t\ta.className = "cardText";`,
        `\t\t\t\tvar div = document.createElement("div");`,
        `\t\t\t\tvar text = document.createTextNode("No Links added");`,
        `\t\t\t\ta.append(div);`,
        `\t\t\t\tdiv.append(text);`,
        `\t\t\t\tlinksRoot.append(a);`,
        `\t\t\t}`,
        `\t\t\tsubmitButton.style.visibility = 'hidden';`,
        `\t\t\tcancelButton.style.visibility = 'hidden';`,
        `\t\t\tshareButton.style.visibility = 'visible';`,
        `\t\t\teditButton.style.visibility = 'visible';`,
        `\t\t\tdropDownButton.style.visibility = 'visible';`,
        `\t\t\tfor(let textLabel of textLabels){`,
        `\t\t\t\ttextLabel.style.visibility = "visible";`,
        `\t\t\t\ttextLabel.style.maxHeight = textLabel.scrollHeight + "px";`,
        `\t\t\t}`,
        `\t\t\tfor(let textField of textFields){`,
        `\t\t\t\ttextField.style.visibility = "hidden";`,
        `\t\t\t\ttextField.style.maxHeight = null;`,
        `\t\t\t}`,
        `\t\t\tconst dayUpdate = {`,
        `\t\t\t\t"day_number": dayNumber,`,
        `\t\t\t\t"title": title,`,
        `\t\t\t\t"description": description,`,
        `\t\t\t\t"links": links.replace(" ", "").split(",")`,
        `\t\t\t};`,
        `\t\t\tvscode.postMessage({command: "editLog", value: dayUpdate});`,
        `\t\t});`,
        `\t}`,
        `</script>`,
        `</html>`,
      ].join("\n");
    }
    return htmlString;
  }
}

export function updateLogsHtml() {
  //updates logs.html

  let filepath = getLogsHtml();
  try {
    fs.writeFileSync(filepath, getUpdatedLogsHtmlString());
  } catch (err) {
    console.log(err);
  }
}
