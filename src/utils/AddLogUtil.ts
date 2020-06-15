import { getSoftwareDir, isWindows, compareDates } from "./Util";
import fs = require("fs");
import { getMostRecentLogObject, getLatestLogEntryNumber } from "./LogsUtil";
import { getSessionCodetimeMetrics } from "./MetricUtil";
import { Log } from "../models/Log";

export function getAddLogHtml() {
    let file = getSoftwareDir();
    if (isWindows()) {
        file += "\\addLog.html";
    } else {
        file += "/addLog.html";
    }
    return file;
}

export function getUpdatedAddLogHtmlString() {
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
    const log: Log = getMostRecentLogObject();
    const dateOb = new Date();
    const date = dateOb.getDate();
    const month = monthNames[dateOb.getMonth()]; // Month is 0 indexed
    const year = dateOb.getFullYear();
    const logDate = new Date(log.date);
    let day = getLatestLogEntryNumber() + 1;

    if (compareDates(dateOb, logDate) && log.title !== "No Title") {
        return "<html><body><br><br><h1>Today's Log already exists. If you want to edit it, please update the Log from the Logs tab in 100 Days of Code.</h1></body></html>";
    } else if (compareDates(dateOb, logDate)) {
        day = log.day_number;
    }

    // metrics is stored as [minutes, keystrokes, lines]
    const metrics: Array<number> = getSessionCodetimeMetrics();
    if (metrics === []) {
        console.log("error fetching metrics");
        return;
    }

    const hour = (metrics[0] / 60).toFixed(1);
    const rawKeystrokes = metrics[1];
    const linesAdded = metrics[2];

    const htmlString = [
        `<html>`,
        `<style>`,
        `\tbody {`,
        `\t\tfont-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen,`,
        `\t\t\tUbuntu, Cantarell, "Open Sans", "Helvetica Neue", sans-serif;`,
        `\t}`,
        `\t#modal {`,
        `\t\tposition: absolute;`,
        `\t\twidth: 450px;`,
        `\t\theight: 520px;`,
        `\t\ttop: 50%;`,
        `\t\tmargin-top: -260px;`,
        `\t\tleft: 50%;`,
        `\t\tmargin-left: -225px;`,
        `\t\tbackground: rgba(255, 255, 255, 0.05);`,
        `\t\tborder-radius: 3px;`,
        `\t}\n`,
        `\t/* Headings */`,
        `\t#head1 {`,
        `\t\tmargin-top: 10px;`,
        `\t\tmargin-left: 10px;`,
        `\t\tfont-size: 23px;`,
        `\t\tline-height: 30px;`,
        `\t\tfont-weight: 600;`,
        `\t}`,
        `\t.head2 {`,
        `\t\tmargin-top: 10px;`,
        `\t\tmargin-left: 10px;`,
        `\t\tfont-size: 14px;`,
        `\t\tcolor: #919eab;`,
        `\t\tfont-weight: 500;`,
        `\t}\n`,
        `\t/* Textboxes */`,
        `\t.text {`,
        `\t\tmargin-left: 10px;`,
        `\t\tmargin-right: 10px;`,
        `\t\tmargin-top: 5px;`,
        `\t\tmargin-bottom: 5px;`,
        `\t\twidth: 415px;`,
        `\t\tfont-size: 16px;`,
        `\t\tborder-radius: 3px;`,
        `\t\tpadding-left: 5px;`,
        `\t\tpadding-right: 5px;`,
        `\t\tborder-color: rgba(0, 0, 0, 0);`,
        `\t\tbackground-color: rgba(255, 255, 255, 0.05);`,
        `\t\tcolor: #ffffff;`,
        `\t\tresize: none;`,
        `\t}\n`,
        `\t/* CodeTime */`,
        `\t#hours {`,
        `\t  width: 40px;`,
        `\t}`,
        `\t.hoursText {`,
        `\t\tmargin-left: -10px;`,
        `\t\tfont-size: 16px;`,
        `\t\tline-height: 20px;`,
        `\t\tcolor: rgba(255, 255, 255, 0.5);`,
        `\t}`,
        `\t.metricsText {`,
        `\t\tmargin-top: 5px;`,
        `\t\tmargin-left: 10px;`,
        `\t\tmargin-right: 15px;`,
        `\t\tfont-size: 12px;`,
        `\t\tcolor: #919eab;`,
        `\t\tfont-weight: 500;`,
        `\t}\n`,
        `\t/* Buttons */`,
        `\t.buttons {`,
        `\t\tmargin-top: 30px;`,
        `\t\tmargin-left: 10px;`,
        `\t}`,
        `\t#cancel {`,
        `\t\tfont-size: 16px;`,
        `\t\tline-height: 25px;`,
        `\t\tcolor: #ffffff;`,
        `\t\tbackground-color: rgba(0, 0, 0, 0);`,
        `\t\tborder-color: rgba(0, 0, 0, 0);`,
        `\t\tborder-radius: 3px;`,
        `\t\tmargin-left: 10px;`,
        `\t\tmargin-bottom: 15px;`,
        `\t}`,
        `\t#submit {`,
        `\t\tfont-size: 16px;`,
        `\t\tline-height: 25px;`,
        `\t\tcolor: #ffffff;`,
        `\t\tbackground: #00b4ee;`,
        `\t\tborder: 3px solid #00b4ee;`,
        `\t\tbox-sizing: border-box;`,
        `\t\tborder-radius: 3px;`,
        `\t\tmargin-bottom: 15px;`,
        `\t}`,
        `</style>`,
        `<body>`,
        `\t<div id="modal">`,
        `\t<div id="head1">Log Today's Progress</div>`,
        `\t<div class="head2">Day ${day}  |  ${month} ${date}, ${year}</div>`,
        `\t<div class="head2">Title</div>`,
        `\t<input`,
        `\t\ttype="text"`,
        `\t\tclass="text"`,
        `\t\tid="title"`,
        `\t\tplaceholder="Title for today's work log"`,
        `\t/>`,
        `\t<div class="head2">Description</div>`,
        `\t<textarea`,
        `\t\tid="description"`,
        `\t\tclass="text"`,
        `\t\tplaceholder="Description for today's work log"`,
        `\t\trows="4"`,
        `\t></textarea>\n`,
        `\t<div class="head2">`,
        `\t\tLink(s) to Today's Work (Separate links with commas)`,
        `\t</div>`,
        `\t<textarea`,
        `\t\tid="links"`,
        `\t\tclass="text"`,
        `\t\tplaceholder="Links to resources, git commits, working projects, etc.."`,
        `\t\trows="3"`,
        `\t></textarea>\n`,
        `\t<div class="head2">Hours coded</div>`,
        `\t<input type="number" class="text" id="hours" value="${hour}" />`,
        `\t<span class="hoursText">hours</span>`,
        `\t<div hidden id="keystrokes">${rawKeystrokes}</div>`,
        `\t<div hidden id="lines">${linesAdded}</div>`,
        `\t<div class="metricsText">`,
        `\t\tYou’ve logged ${hour} hours, ${rawKeystrokes} keystrokes, and ${linesAdded} lines of code so far`,
        `\t\ttoday based on our Code Time plugin.`,
        `\t</div>`,
        `\t<div class="buttons">`,
        `\t\t<button id="cancel">Cancel</button>`,
        `\t\t<button id="submit">Submit</button>`,
        `\t</div>`,
        `\t</div>`,
        `</body>`,
        `<script>`,
        `\tlet vscode;`,
        `\tlet submit;`,
        `\tlet cancel;`,
        `\twindow.addEventListener("load", () => {`,
        `\ttry {`,
        `\t\tvscode = acquireVsCodeApi();`,
        `\t} catch (err) {`,
        `\t\tconsole.log(err);`,
        `\t}\n`,
        `\tcancel = document.getElementById("cancel");`,
        `\tsubmit = document.getElementById("submit");\n`,
        `\tcancel.addEventListener("click", cancelLog);`,
        `\tsubmit.addEventListener("click", submitLog);`,
        `\t});\n`,
        `\tfunction cancelLog() {`,
        `\tvscode.postMessage({ command: "cancel" });`,
        `\t}\n`,
        `\tfunction submitLog() {`,
        `\t\tvar title = document.getElementById("title").value;`,
        `\t\tvar description = document.getElementById("description").value;`,
        `\t\tvar links = document.getElementById("links").value.replace(" ", "").split(",");`,
        `\t\tvar hours = parseFloat(document.getElementById("hours").value).toFixed(2);`,
        `\t\tif(hours>24){`,
        `\t\t\thours=24;`,
        `\t\t}`,
        `\t\tif(hours<0){`,
        `\t\t\thours=0;`,
        `\t\t}`,
        `\t\tvar lines = document.getElementById("lines").textContent;`,
        `\t\tvar keystrokes = document.getElementById("keystrokes").textContent;\n`,
        `\t\tconst log = {`,
        `\t\t\ttitle,`,
        `\t\t\tdescription,`,
        `\t\t\tlinks,`,
        `\t\t\thours,`,
        `\t\t\tlines,`,
        `\t\t\tkeystrokes`,
        `\t\t};\n`,
        `\t\tvscode.postMessage({ command: 'log', value: log });\n`,
        `\t`,
        `\t}`,
        `</script>`,
        `</html>`
    ].join("\n");

    return htmlString;
}

export function updateAddLogHtml() {
    let filepath = getAddLogHtml();
    try {
        fs.writeFileSync(filepath, getUpdatedAddLogHtmlString());
    } catch (err) {
        console.log(err);
    }
}
