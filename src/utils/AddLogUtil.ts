import path = require("path");
import fs = require("fs");
import { getDayNumberForNewLog } from "./LogsUtil";
import { getSessionCodetimeMetrics } from "./MetricUtil";
import { monthNames } from "./Constants";
import { getInputFormStyles } from "./Util";

function getAddLogTemplate(): string {
    return path.join(__dirname, "/assets/templates/addLog.template.html");
}

export function getAddLogHtmlString(): string {
    const dateOb = new Date();
    const date = dateOb.getDate();
    const month = monthNames[dateOb.getMonth()]; // Month is 0 indexed
    const year = dateOb.getFullYear();
    let day = getDayNumberForNewLog();

    // metrics is stored as [minutes, keystrokes, lines]
    const metrics = getSessionCodetimeMetrics();
    const hours = (metrics.minutes / 60).toFixed(1);
    const keystrokes = metrics.keystrokes;
    const linesAdded = metrics.linesAdded;
    const { cardTextColor, cardBackgroundColor, cardGrayedLevel, sharePath } = getInputFormStyles();

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
    const fillTemplate = function (templateString: string, templateVars: any) {
        return new Function("return `" + templateString + "`;").call(templateVars);
    };

    const addLogHtmlContent = fillTemplate(templateString, templateVars);
    return addLogHtmlContent;
}
