import { getSoftwareDir, isWindows } from "./Util";
import fs = require("fs");
import { getLatestLogEntryNumber } from "./LogsUtil";
import { getSessionCodetimeMetrics } from "./MetricUtil";

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
    const day = getLatestLogEntryNumber() + 1;
    if (day === 0) {
        return "<html><body><br><br><h1>Today's Log already exists. If you want to edit it, please update the Log from the Logs tab in 100 Days of Code.</h1></body></html>";
    }

    const dateOb = new Date();
    const date = dateOb.getDate();
    const month = dateOb.getMonth() + 1; // Month is 0 indexed
    const year = dateOb.getFullYear();

    // metrics is stored as [minutes, keystrokes, lines]
    const metrics: Array<number> = getSessionCodetimeMetrics();
    if (metrics === []) {
        console.log("error fetching metrics");
        return;
    }

    const hour = (metrics[0] / 60).toFixed(1);
    const rawKeystrokes = metrics[1];
    const keystrokes = (rawKeystrokes / 1000).toFixed(1);
    const linesAdded = metrics[2];

    const htmlString = [
        `<html>`,
        `<style>`,
        `\tbody {`,
        `\tfont-family: sans-serif;`,
        `\t}`,
        `\t#modal {`,
        `\tposition: absolute;`,
        `\twidth: 600px;`,
        `\theight: 650px;`,
        `\ttop: 50%;`,
        `\tmargin-top: -325px;`,
        `\tleft: 50%;`,
        `\tmargin-left: -300px;`,
        `\tbackground: #333333;`,
        `\tborder-radius: 20px;`,
        `\t}\n`,
        `\t/* Headings */`,
        `\t#head1 {`,
        `\tmargin-top: 10px;`,
        `\ttext-align: center;`,
        `\tfont-size: 24px;`,
        `\tline-height: 30px;`,
        `\tfont-weight: bold;`,
        `\t}`,
        `\t.head2 {`,
        `\tmargin-left: 20px;`,
        `\tmargin-top: 10px;`,
        `\tfont-size: 20px;`,
        `\tline-height: 25px;`,
        `\tfont-weight: bolder;`,
        `\t}`,
        `\t.head3 {`,
        `\tmargin-left: 20px;`,
        `\tmargin-top: 5px;`,
        `\tfont-size: 16px;`,
        `\tline-height: 20px;`,
        `\tcolor: rgba(255, 255, 255, 0.6);`,
        `\t}\n`,
        `\t/* Textboxes */`,
        `\t.text {`,
        `\tmargin-left: 20px;`,
        `\tmargin-right: 20px;`,
        `\tmargin-top: 5px;`,
        `\tmargin-bottom: 5px;`,
        `\twidth: 540px;`,
        `\tfont-size: 18px;`,
        `\tborder-radius: 5px;`,
        `\tpadding-left: 5px;`,
        `\tpadding-right: 5px;`,
        `\t}\n`,
        `\t/* CodeTime */`,
        `\t.codeTimeHeads {`,
        `\tdisplay: grid;`,
        `\tgrid-template-columns: repeat(3, 200px);`,
        `\t}`,
        `\t.codeTimeText {`,
        `\tmargin-left: 20px;`,
        `\tmargin-top: 10px;`,
        `\tfont-size: 16px;`,
        `\tline-height: 20px;`,
        `\tcolor: rgba(255, 255, 255, 0.6);`,
        `\t}`,
        `\t#hours {`,
        `\tmargin-left: 20px;`,
        `\tmargin-top: 5px;`,
        `\twidth: 40px;`,
        `\tfont-size: 18px;`,
        `\tborder-radius: 5px;`,
        `\tpadding-left: 5px;`,
        `\tpadding-right: 5px;`,
        `\t}`,
        `\t.hoursText {`,
        `\tfont-size: 18px;`,
        `\tline-height: 20px;`,
        `\tcolor: rgba(255, 255, 255, 0.6);`,
        `\t}\n`,
        `\t/* Buttons */`,
        `\t.buttons {`,
        `\tposition: absolute;`,
        `\tbottom: 15px;`,
        `\tright: 15px;`,
        `\t}`,
        `\t#cancel {`,
        `\tfont-size: 20px;`,
        `\tline-height: 25px;`,
        `\tcolor: #ffffff;`,
        `\tbackground: #6d6d6d;`,
        `\tborder: 1px solid #1e1e1e;`,
        `\tbox-sizing: border-box;`,
        `\tborder-radius: 5px;`,
        `\tmargin-right: 10px;`,
        `\t}`,
        `\t#submit {`,
        `\tfont-size: 20px;`,
        `\tline-height: 25px;`,
        `\tcolor: #ffffff;`,
        `\tbackground: linear-gradient(`,
        `\t\t0deg,`,
        `\t\trgba(0, 180, 238, 0.2),`,
        `\t\trgba(0, 180, 238, 0.2)`,
        `\t\t),`,
        `\t\t#333333;`,
        `\tborder: 1px solid #00b4ee;`,
        `\tbox-sizing: border-box;`,
        `\tborder-radius: 5px;`,
        `\t}`,
        `</style>`,
        `<body>`,
        `\t<div id="modal">`,
        `\t<div id="head1">Today's Log Entry<br />Day ${day}: ${month}/${date}/${year}</div>\n`,
        `\t<div class="head2">Today's Progress</div>`,
        `\t<div class="head3">Title</div>`,
        `\t<input`,
        `\t\ttype="text"`,
        `\t\tclass="text"`,
        `\t\tid="title"`,
        `\t\tplaceholder="Title for today's work log"`,
        `\t/>`,
        `\t<div class="head3">Description</div>`,
        `\t<textarea`,
        `\t\tid="description"`,
        `\t\tclass="text"`,
        `\t\tplaceholder="Description for today's work log"`,
        `\t\trows="4"`,
        `\t></textarea>\n`,
        `\t<div class="head2">Link to Today's Work</div>`,
        `\t<div class="head3">Comma Separated</div>`,
        `\t<textarea`,
        `\t\tid="links"`,
        `\t\tclass="text"`,
        `\t\tplaceholder="Links to resources, git commits, working projects, etc.."`,
        `\t\trows="3"`,
        `\t></textarea>\n`,
        `\t<div class="head2">Code Time Metrics</div>`,
        `\t<div class="codeTimeHeads">`,
        `\t\t<div class="head3">Hours</div>`,
        `\t\t<div class="head3">Lines Added</div>`,
        `\t\t<div class="head3">Keystrokes</div>`,
        `\t</div>`,
        `\t<div class="codeTimeHeads">`,
        `\t\t<div>`,
        `\t\t<input type="number" class="hours" id="hours" value="${hour}" />`,
        `\t\t<span class="hoursText">Hrs</span>`,
        `\t\t</div>`,
        `\t\t<div class="codeTimeText">${linesAdded} Lines</div>`,
        `\t\t<div class="codeTimeText">${keystrokes}k</div>`,
        `\t\t<div hidden id="keystrokes">${rawKeystrokes}</div>`,
        `\t\t<div hidden id="lines">${linesAdded}</div>`,
        `\t</div>\n`,
        `\t<div class="buttons">`,
        `\t\t<button id="cancel">Cancel</button>`,
        `\t\t<button id="submit">Log</button>`,
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
