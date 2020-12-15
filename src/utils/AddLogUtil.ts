import path = require("path");
import fs = require("fs");
import { getDayNumberForNewLog } from "./LogsUtil";
import { getSessionCodetimeMetrics } from "./MetricUtil";
import { monthNames } from "./Constants";
import { window } from "vscode";

function getAddLogTemplate(): string {
    return path.join(__dirname, "/assets/templates/addLog.template.html");
}

function getStyleColorsBasedOnMode(): any {
    // if in light mode
    const tempWindow: any = window;

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
    const fillTemplate = function (templateString: string, templateVars: any) {
        return new Function("return `" + templateString + "`;").call(templateVars);
    };

    const addLogHtmlContent = fillTemplate(templateString, templateVars);
    return addLogHtmlContent;
}
