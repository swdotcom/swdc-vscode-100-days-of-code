"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUpdatedAddLogHtmlString = void 0;
const Util_1 = require("./Util");
const path = require("path");
const fs = require("fs");
const LogsUtil_1 = require("./LogsUtil");
const MetricUtil_1 = require("./MetricUtil");
const Constants_1 = require("./Constants");
const vscode_1 = require("vscode");
function getAddLogTemplate() {
    return path.join(__dirname, "/assets/templates/addLog.template.html");
    // return path.join(__dirname, "../assets/templates/addLog.template.html");
}
function getStyleColorsBasedOnMode() {
    // if in light mode
    const tempWindow = vscode_1.window;
    let cardTextColor = "#FFFFFF";
    let cardBackgroundColor = "rgba(255,255,255,0.05)";
    let cardGrayedLevel = "#474747";
    let sharePath = "https://100-days-of-code.s3-us-west-1.amazonaws.com/Milestones/share.svg";
    if (tempWindow.activeColorTheme.kind === 1) {
        cardTextColor = "#444444";
        cardBackgroundColor = "rgba(0,0,0,0.10)";
        cardGrayedLevel = "#B5B5B5";
        sharePath = "https://100-days-of-code.s3-us-west-1.amazonaws.com/Milestones/shareLight.svg";
    }
    return { cardTextColor, cardBackgroundColor, cardGrayedLevel, sharePath };
}
function getUpdatedAddLogHtmlString() {
    const log = LogsUtil_1.getMostRecentLogObject();
    const dateOb = new Date();
    const date = dateOb.getDate();
    const month = Constants_1.monthNames[dateOb.getMonth()]; // Month is 0 indexed
    const year = dateOb.getFullYear();
    const logDate = new Date(log.date);
    let day = LogsUtil_1.getLatestLogEntryNumber() + 1;
    if (Util_1.compareDates(dateOb, logDate) && log.title !== Constants_1.NO_TITLE_LABEL) {
        return "<html><body><br><br><h1>Today's Log already exists. If you want to edit it, please update the Log from the Logs tab in 100 Days of Code.</h1></body></html>";
    }
    else if (Util_1.compareDates(dateOb, logDate)) {
        day = log.day_number;
    }
    // metrics is stored as [minutes, keystrokes, lines]
    const metrics = MetricUtil_1.getSessionCodetimeMetrics();
    const hours = (metrics.minutes / 60).toFixed(1);
    const keystrokes = metrics.keystrokes;
    const linesAdded = metrics.linesAdded;
    const { cardTextColor, cardBackgroundColor, cardGrayedLevel, sharePath } = getStyleColorsBasedOnMode();
    const templateVars = {
        cardTextColor,
        cardBackgroundColor,
        cardGrayedLevel,
        sharePath,
        date,
        month,
        year,
        day,
        hours,
        keystrokes,
        linesAdded
    };
    const templateString = fs.readFileSync(getAddLogTemplate()).toString();
    const fillTemplate = function (templateString, templateVars) {
        return new Function("return `" + templateString + "`;").call(templateVars);
    };
    const addLogHtmlContent = fillTemplate(templateString, templateVars);
    return addLogHtmlContent;
}
exports.getUpdatedAddLogHtmlString = getUpdatedAddLogHtmlString;
//# sourceMappingURL=addLogUtil.js.map