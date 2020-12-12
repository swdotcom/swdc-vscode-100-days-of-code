"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUpdatedMilestonesHtmlString = void 0;
const vscode_1 = require("vscode");
const path = require("path");
const fs = require("fs");
const MilestonesUtil_1 = require("./MilestonesUtil");
const Util_1 = require("./Util");
const Constants_1 = require("./Constants");
function getMilestonesTemplate() {
    return path.join(__dirname, "/assets/templates/milestones.template.html");
    // return path.join(__dirname, "../assets/templates/milestones.template.html");
}
function generateShareUrl(id, title, description) {
    const hashtagURI = "%23";
    const shareText = [`${title} - ${description}`, `\nWoohoo! I earned a new`].join("\n");
    const shareURI = encodeURI(shareText);
    const url = `https://twitter.com/intent/tweet?url=https%3A%2F%2Fwww.software.com%2Fmilestone%2F${id}&text=${shareURI}%20${hashtagURI}100DaysOfCode%20milestone%20via%20@software_hq's%20${hashtagURI}vscode%20extension`;
    return url;
}
function getStyleColorsBasedOnMode() {
    const tempWindow = vscode_1.window;
    let cardTextColor = "#FFFFFF";
    let cardBackgroundColor = "rgba(255,255,255,0.05)";
    let cardGrayedLevel = "#606060";
    let cardGrayedLevelFont = "#A2A2A2";
    if (tempWindow.activeColorTheme.kind === 1) {
        cardTextColor = "#444444";
        cardBackgroundColor = "rgba(0,0,0,0.10)";
        cardGrayedLevel = "#A2A2A2";
        cardGrayedLevelFont = "#606060";
    }
    return { cardTextColor, cardBackgroundColor, cardGrayedLevel, cardGrayedLevelFont };
}
function getUpdatedMilestonesHtmlString() {
    const { cardTextColor, cardBackgroundColor, cardGrayedLevel, cardGrayedLevelFont } = getStyleColorsBasedOnMode();
    const milestoneData = MilestonesUtil_1.getAllMilestones();
    // for adding to the html string later
    let recents = "";
    let allMilestones = "\n\t\t<hr>\n\t\t<h2>All Milestones</h2>\n";
    // share icon
    if (milestoneData && milestoneData.milestones) {
        const milestones = milestoneData.milestones;
        for (let i = 0; i < milestones.length; i++) {
            const milestone = milestones[i];
            const id = milestone.id;
            const title = milestone.title;
            const description = milestone.description;
            const level = milestone.level;
            const achieved = milestone.achieved;
            const shareIcon = "https://100-days-of-code.s3-us-west-1.amazonaws.com/Milestones/share.svg";
            let icon;
            let dateAchieved = 0;
            const shareLink = generateShareUrl(i + 1, title, description);
            // If achieved, card must be colored. Otherwise, card should be gray
            // for adding gray scale effect class into html
            let grayedCard = "";
            let grayedLevel = "";
            // can only share if achieved
            let shareHtml = "";
            // can only have date if achieved
            let dateHtml = "";
            // Re: If achieved, card must be colored. Otherwise, card should be gray
            if (achieved) {
                icon = milestone.icon;
                dateAchieved = milestone.date_achieved;
                shareHtml = `\t\t\t<a href="${shareLink}" title="Share this on Twitter"><img src="${shareIcon}" class="milestoneShare" alt="Share"/></a>`;
                // getting date in mm/dd/yyyy format
                let dateOb = new Date(dateAchieved);
                const dayNum = dateOb.getDate();
                const month = Constants_1.monthNames[dateOb.getMonth()];
                const year = dateOb.getFullYear();
                dateHtml = `\t\t\t<div class="date">${month} ${dayNum}, ${year}</div>`;
            }
            else {
                icon = milestone.gray_icon;
                grayedCard = "grayed";
                grayedLevel = "grayedLevel";
            }
            // if level 0, no level tag on top.
            // if level 6, replace it with ∞
            let levelHtml = "";
            if (level > 0 && level < 6) {
                levelHtml = `\t\t\t<div class="milestoneCardLevel ${grayedLevel}">Level ${level}</div>`;
            }
            else if (level === 6) {
                levelHtml = `\t\t\t<div class="milestoneCardLevel ${grayedLevel}">Level <span class="inf">∞</span></div>`;
            }
            const milestoneCardHtml = [
                `\t\t<div class="milestoneCard ${grayedCard}">`,
                `\t\t\t<div class="hiddenId">${id}</div>`,
                `${levelHtml}`,
                `${shareHtml}`,
                `\t\t\t<div class="milestoneTitle">${title}</div>`,
                `\t\t\t<img class="logo" src=${icon} alt="Icon">`,
                `\t\t\t<div class="milestoneDesc">${description}</div>`,
                `${dateHtml}`,
                `\t\t</div>\n`
            ].join("\n");
            // Checks for the same date
            const dateNow = new Date();
            const dateOb = new Date(dateAchieved);
            if (Util_1.compareDates(dateOb, dateNow)) {
                if (recents === "") {
                    recents += `\n\t\t<h2>Today's Milestones</h2>\n`;
                }
                recents += milestoneCardHtml;
            }
            allMilestones += milestoneCardHtml;
        }
    }
    // If no milestones earned today
    if (recents === "") {
        recents += `\n\t\t<h2>Today's Milestones</h2>\n`;
        recents += `\t\t<div class="noMilestones">No milestones earned today</div>\n`;
    }
    const templateVars = {
        cardTextColor,
        cardBackgroundColor,
        cardGrayedLevel,
        cardGrayedLevelFont,
        recents,
        allMilestones
    };
    const templateString = fs.readFileSync(getMilestonesTemplate()).toString();
    const fillTemplate = function (templateString, templateVars) {
        return new Function("return `" + templateString + "`;").call(templateVars);
    };
    const milestoneHtmlContent = fillTemplate(templateString, templateVars);
    return milestoneHtmlContent;
}
exports.getUpdatedMilestonesHtmlString = getUpdatedMilestonesHtmlString;
//# sourceMappingURL=MilestonesTemplateUtil.js.map