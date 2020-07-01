import { window } from "vscode";
import path = require("path");
import fs = require("fs");
import { getAllMilestones } from "./MilestonesUtil";
import { compareDates } from "./Util";

function getMilestonesTemplate(): string {
    return path.join(__dirname, "../assets/templates/milestones.template.html");
}

function milestoneShareUrlGenerator(id: number, title: string, description: string): string {
    const beginURI = "https://twitter.com/intent/tweet?url=https%3A%2F%2Fwww.software.com%2Fmilestone%2F";
    const endURI =
        "%0aWoohoo%21%20I%20earned%20this%20milestone%20while%20completing%20the%20%23100DaysOfCode%20Challenge%20with%20@software_hq%27s%20100%20Days%20of%20Code%20VS%20Code%20Plugin.&hashtags=100DaysOfCode%2CSoftware%2CDeveloper%2CAchiever";
    const titleURI = encodeURI(title);
    const descriptionURI = encodeURI(description);
    let url = `${beginURI}${id}&text=${titleURI}%20-%20${descriptionURI}${endURI}`;
    return url;
}

function getStyleColorsBasedOnMode(): any {
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

export function getUpdatedMilestonesHtmlString(): string {
    const { cardTextColor, cardBackgroundColor, cardGrayedLevel, sharePath } = getStyleColorsBasedOnMode();

    // for calculating recents
    const date = Date.now();

    const milestones = getAllMilestones();

    // for adding to the html string later
    let recents: string = "";
    let allMilestones: string = "\n\t\t<hr>\n\t\t<h2>All Milestones</h2>\n";

    // share icon
    for (let i = 0; i < milestones.length; i++) {
        const milestone = milestones[i];
        const id: number = milestone.id;
        const title: string = milestone.title;
        const description: string = milestone.description;
        const level: number = milestone.level;
        const achieved: boolean = milestone.achieved;
        const shareIcon: string = milestone.shared
            ? "https://100-days-of-code.s3-us-west-1.amazonaws.com/Milestones/alreadyShared.svg"
            : sharePath;

        let icon: string;
        let dateAchieved: number = 0;
        const shareLink = milestoneShareUrlGenerator(i + 1, title, description);
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
            const month = dateOb.getMonth() + 1; // Month is 0 indexed
            const year = dateOb.getFullYear();

            dateHtml = `\t\t\t<div class="date">${month}/${dayNum}/${year}</div>`;
        } else {
            icon = milestone.gray_icon;
            grayedCard = "grayed";
            grayedLevel = "grayedLevel";
        }

        // if level 0, no level tag on top.
        // if level 6, replace it with ∞
        let levelHtml: string = "";
        if (level > 0 && level < 6) {
            levelHtml = `\t\t\t<div class="level${level} milestoneCardLevel ${grayedLevel}">Level ${level}</div>`;
        } else if (level === 6) {
            levelHtml = `\t\t\t<div class="level${level} milestoneCardLevel ${grayedLevel}">Level <span class="inf">∞</span></div>`;
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

    // If no milestones earned today
    if (recents === "") {
        recents += `\n\t\t<h2>Today's Milestones</h2>\n`;
        recents += `\t\t<div class="noMilestones">No new Milestones today</div>\n`;
    }

    const templateVars = {
        cardTextColor,
        cardBackgroundColor,
        cardGrayedLevel,
        sharePath,
        recents,
        allMilestones
    };

    const templateString = fs.readFileSync(getMilestonesTemplate()).toString();
    const fillTemplate = function (templateString: string, templateVars: any) {
        return new Function("return `" + templateString + "`;").call(templateVars);
    };

    const milestoneHtmlContent = fillTemplate(templateString, templateVars);
    return milestoneHtmlContent;
}
