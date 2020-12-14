import { window } from "vscode";
import path = require("path");
import fs = require("fs");
import { getAllMilestones } from "./MilestonesUtil";
import { compareDates, isLoggedIn } from "./Util";
import { monthNames } from "./Constants";

function getMilestonesTemplate(): string {
    return path.join(__dirname, "/assets/templates/milestones.template.html");
}

function generateShareUrl(id: number, title: string, description: string): string {
    const hashtagURI = "%23";
    const shareText = [`${title} - ${description}`, `\nWoohoo! I earned a new`].join("\n");
    const shareURI = encodeURI(shareText);
    const url = `https://twitter.com/intent/tweet?url=https%3A%2F%2Fwww.software.com%2Fmilestone%2F${id}&text=${shareURI}%20${hashtagURI}100DaysOfCode%20milestone%20via%20@software_hq's%20${hashtagURI}vscode%20extension`;
    return url;
}

function getStyleColorsBasedOnMode(): any {
    const tempWindow: any = window;

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

export function getUpdatedMilestonesHtmlString(): string {
    const { cardTextColor, cardBackgroundColor, cardGrayedLevel, cardGrayedLevelFont } = getStyleColorsBasedOnMode();

    const milestoneData = getAllMilestones();

    // for adding to the html string later
    let recents: string = "";
    let allMilestones: string = "\n\t\t<hr>\n\t\t<h2>All Milestones</h2>\n";

    // share icon
    if (milestoneData && milestoneData.milestones) {
        const milestones = milestoneData.milestones;
        for (let i = 0; i < milestones.length; i++) {
            const milestone = milestones[i];
            const id: number = milestone.id;
            const title: string = milestone.title;
            const description: string = milestone.description;
            const level: number = milestone.level;
            const achieved: boolean = milestone.achieved;
            const shareIcon: string = "https://100-days-of-code.s3-us-west-1.amazonaws.com/Milestones/share.svg";

            let icon: string;
            let dateAchieved: number = 0;
            const shareLink = generateShareUrl(i + 1, title, description);
            // If achieved, card must be colored. Otherwise, card should be gray

            // for adding gray scale effect class into html
            let grayedCard: string = "";
            let grayedLevel: string = "";

            // can only share if achieved
            let shareHtml: string = "";

            // can only have date if achieved
            let dateHtml: string = "";

            // Re: If achieved, card must be colored. Otherwise, card should be gray
            if (achieved) {
                icon = milestone.icon;
                dateAchieved = milestone.date_achieved;
                shareHtml = `\t\t\t<a href="${shareLink}" title="Share this on Twitter"><img src="${shareIcon}" class="milestoneShare" alt="Share"/></a>`;

                // getting date in mm/dd/yyyy format
                let dateOb = new Date(dateAchieved);

                const dayNum = dateOb.getDate();
                const month = monthNames[dateOb.getMonth()];
                const year = dateOb.getFullYear();

                dateHtml = `\t\t\t<div class="date">${month} ${dayNum}, ${year}</div>`;
            } else {
                icon = milestone.gray_icon;
                grayedCard = "grayed";
                grayedLevel = "grayedLevel";
            }

            // if level 0, no level tag on top.
            // if level 6, replace it with ∞
            let levelHtml: string = "";
            if (level > 0 && level < 6) {
                levelHtml = `\t\t\t<div class="milestoneCardLevel ${grayedLevel}">Level ${level}</div>`;
            } else if (level === 6) {
                levelHtml = `\t\t\t<div class="milestoneCardLevel ${grayedLevel}">Level <span class="inf">∞</span></div>`;
            }

            const milestoneCardHtml: string = [
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
            if (compareDates(dateOb, dateNow)) {
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

    let logInVisibility = "hidden";
    let logInMessageDisplay = "none";
    if (!isLoggedIn()) {
        logInVisibility = "visible";
        logInMessageDisplay = "";
    }

    const templateVars = {
        cardTextColor,
        cardBackgroundColor,
        cardGrayedLevel,
        cardGrayedLevelFont,
        recents,
        allMilestones,
        logInVisibility,
        logInMessageDisplay
    };

    const templateString = fs.readFileSync(getMilestonesTemplate()).toString();
    const fillTemplate = function (templateString: string, templateVars: any) {
        return new Function("return `" + templateString + "`;").call(templateVars);
    };

    const milestoneHtmlContent = fillTemplate(templateString, templateVars);
    return milestoneHtmlContent;
}
