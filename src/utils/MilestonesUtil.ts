import { getSoftwareDir, isWindows } from "./Util";
import fs = require("fs");
import { window } from "vscode";
import path = require("path");
import { updateLogsMilestonesAndMetrics } from "./LogsUtil";
// import { Milestone } from "../models/Milestone";

export function getMilestonesJson() {
  let file = getSoftwareDir();
  if (isWindows()) {
    file += "\\milestones.json";
  } else {
    file += "/milestones.json";
  }
  return file;
}

export function checkMilestonesJson() {
  const filepath = getMilestonesJson();
  try {
    if (fs.existsSync(filepath)) {
      return true;
    } else {
      const src = path.join(__dirname, "../assets/milestones.json");
      fs.copyFileSync(src, filepath);
      return true;
    }
  } catch (err) {
    return false;
  }
}

function checkIdRange(id: number) {
  const MIN_ID = 1;
  const MAX_ID = 56;

  if (id >= MIN_ID && id <= MAX_ID) {
    return true;
  }
  return false;
}
// Used by logs
export function getMilestoneById(id: number) {
  const exists = checkMilestonesJson();
  if (!exists) {
    window.showErrorMessage("Cannot access Milestones file!");
  }
  if (!checkIdRange(id)) {
    window.showErrorMessage("Incorrect Milestone Id!");
    return {};
  }
  const filepath = getMilestonesJson();
  let rawMilestones = fs.readFileSync(filepath).toString();
  let milestones = JSON.parse(rawMilestones).milestones;
  return milestones[id - 1];
}

// Achieved Milestone change in json and logs
export function achievedMilestonesJson(id: number) {
  const exists = checkMilestonesJson();
  if (!exists) {
    window.showErrorMessage("Cannot access Milestones file!");
  }

  if (!checkIdRange(id)) {
    window.showErrorMessage("Incorrect Milestone Id!");
    return;
  }
  const filepath = getMilestonesJson();
  let rawMilestones = fs.readFileSync(filepath).toString();
  let milestones = JSON.parse(rawMilestones).milestones;
  const date = Date.now().valueOf(); // getting date in unix format
  milestones[id - 1].achieved = true; // id is indexed starting 1
  milestones[id - 1].date_achieved = date;
  var sendMilestones = { milestones };
  try {
    fs.writeFileSync(filepath, JSON.stringify(sendMilestones, null, 4));
  } catch (err) {
    console.log(err);
  }
  updateLogsMilestonesAndMetrics([id]);
}
export function getMilestonesHtml() {
  let file = getSoftwareDir();
  if (isWindows()) {
    file += "\\milestones.html";
  } else {
    file += "/milestones.html";
  }
  return file;
}

export function milestoneShareUrlGenerator(
  id: number,
  title: string,
  description: string
): string {
  const beginURI =
    "https://twitter.com/intent/tweet?url=https%3A%2F%2Fwww.software.com%2Fmilestone%2F";
  const endURI =
    "%0aWoohoo%21%20I%20earned%20this%20milestone%20while%20completing%20the%20%23100DaysOfCode%20Challenge%20with%20@software_hq%27s%20100%20Days%20of%20Code%20VS%20Code%20Plugin.&hashtags=100DaysOfCode%2CSoftware%2CDeveloper%2CAchiever";
  const titleURI = encodeURI(title);
  const descriptionURI = encodeURI(description);
  var url = `${beginURI}${id}&text=${titleURI}%20-%20${descriptionURI}${endURI}`;
  return url;
}
export function getUpdatedMilestonesHtmlString() {
  // Checks if the file exists and if not, creates a new file
  const exists = checkMilestonesJson();
  if (exists) {
    const filepath = getMilestonesJson();
    let rawMilestones = fs.readFileSync(filepath).toString();
    let milestones = JSON.parse(rawMilestones).milestones;
    let htmlString = [
      `<html>`,
      `\t<style>`,
      `\t\tbody{`,
      `\t\t\tfont-family: sans-serif;`,
      `\t\t}`,
      `\t\th1 {`,
      `\t\t\tfont-size: 32px;`,
      `\t\t\tfont-weight: 600;`,
      `\t\t}`,
      `\t\th2{`,
      `\t\t\tfont-size: 28px;`,
      `\t\t\tfont-weight: 600;`,
      `\t\t}`,
      `\t\thr{`,
      `\t\t\theight: 3px;`,
      `\t\t\tborder: none; `,
      `\t\t\tcolor: #333333; `,
      `\t\t\tbackground-color: #333333;`,
      `\t\t}\n`,
      `\t\t/* levels */`,
      `\t\t.keys{`,
      `\t\t\tdisplay: inline-block;`,
      `\t\t\tfont-size: 20px;`,
      `\t\t\twidth: 50px;`,
      `\t\t}`,
      `\t\t.top-levels{`,
      `\t\t\tdisplay: inline-block;`,
      `\t\t\tborder-radius: 3px;`,
      `\t\t\twidth: 80px;`,
      `\t\t\tfont-size: 20px;`,
      `\t\t\ttext-align: center;`,
      `\t\t\tvertical-align: middle;`,
      `\t\t\theight: 30px;`,
      `\t\t\tline-height: 30px;`,
      `\t\t\tmargin-right: 5px;`,
      `\t\t}`,
      `\t\t.level1{`,
      `\t\t\tbackground: linear-gradient(180deg, rgba(251, 0, 0, 0.2) 0%, rgba(255, 151, 213, 0.2) 100%);`,
      `\t\t}`,
      `\t\t.level2{`,
      `\t\t\tbackground: linear-gradient(180deg, rgba(255, 245, 0, 0.2) 0%, rgba(133, 250, 56, 0.2) 70.3%, rgba(0, 140, 39, 0.2) 100%);`,
      `\t\t}`,
      `\t\t.level3{`,
      `\t\t\tbackground: linear-gradient(180deg, rgba(214, 126, 255, 0.2) 0%, rgba(86, 113, 255, 0.2) 67.71%, rgba(0, 224, 255, 0.2) 100%);`,
      `\t\t}`,
      `\t\t.level4{`,
      `\t\t\tbackground: linear-gradient(180deg, rgba(255, 0, 0, 0.2) 2.05%, rgba(255, 168, 0, 0.2) 73.44%, rgba(255, 245, 0, 0.2) 100%);`,
      `\t\t}`,
      `\t\t.level5{`,
      `\t\t\tbackground: linear-gradient(180deg, rgba(0, 224, 255, 0.2) 0%, rgba(219, 0, 255, 0.2) 49.6%, rgba(253, 106, 0, 0.2) 100%);`,
      `\t\t}`,
      `\t\t.level6{`,
      `\t\t\tbackground: linear-gradient(180deg, rgba(219, 0, 255, 0.2) 3.41%, rgba(103, 115, 255, 0.2) 18.6%, rgba(13, 208, 255, 0.2) 32.96%, rgba(88, 213, 51, 0.2) 51.83%, rgba(255, 237, 1, 0.2) 75.22%, rgba(255, 97, 1, 0.2) 86.71%, rgba(255, 10, 1, 0.2) 100%);`,
      `\t\t}`,
      `\t\t.inf{`,
      `\t\t\tfont-size: larger;`,
      `\t\t}\n`,
      `\t\t/* Milestone card */`,
      `\t\t.milestoneCard{`,
      `\t\t\tbackground-color: #333333;`,
      `\t\t\tdisplay: inline-block;`,
      `\t\t\tmargin: 10px;`,
      `\t\t\tposition: relative;`,
      `\t\t\theight: 235px;`,
      `\t\t\twidth: 200px;`,
      `\t\t\tborder-radius: 10px;`,
      `\t\t}`,
      `\t\t.milestoneShare{`,
      `\t\t\tposition: absolute;`,
      `\t\t\tright: 10px;`,
      `\t\t\ttop: 10px;`,
      `\t\t\theight: auto;`,
      `\t\t\twidth: 10px;`,
      `\t\t}`,
      `\t\t.milestoneCardLevel{`,
      `\t\t\tposition: absolute;`,
      `\t\t\twidth: 50px;`,
      `\t\t\theight: 18px;`,
      `\t\t\tleft: 7px;`,
      `\t\t\ttop: 7px;`,
      `\t\t\tline-height: 18px;`,
      `\t\t\tfont-size: 12px;`,
      `\t\t\tfont-weight: 250;`,
      `\t\t\tborder-radius: 3px;`,
      `\t\t\ttext-align: center;`,
      `\t\t\tvertical-align: middle;`,
      `\t\t}`,
      `\t\t.milestoneTitle{`,
      `\t\t\tposition: absolute;`,
      `\t\t\ttop: 27px;`,
      `\t\t\ttext-align: center;`,
      `\t\t\twidth: inherit;`,
      `\t\t\tfont-size: large;`,
      `\t\t\tfont-weight: 350;`,
      `\t\t}`,
      `\t\t.logo{`,
      `\t\t\theight: 100px;`,
      `\t\t\twidth: 100px;`,
      `\t\t\tposition: absolute;`,
      `\t\t\ttop: 60px;`,
      `\t\t\tleft: 50px;`,
      `\t\t}`,
      `\t\t.milestoneDesc{`,
      `\t\t\tposition: absolute;;`,
      `\t\t\twidth: inherit;`,
      `\t\t\ttext-align: center;`,
      `\t\t\tfont-size: 14px;`,
      `\t\t\tbottom: 40px;\n`,
      `\t\t}`,
      `\t\t.date{ `,
      `\t\t\tposition: absolute;`,
      `\t\t\twidth: inherit;`,
      `\t\t\ttext-align: center;`,
      `\t\t\tfont-size: 14px;`,
      `\t\t\tfont-weight: 350;`,
      `\t\t\tbottom: 10px;`,
      `\t\t\tcolor: #919EAB;`,
      `\t\t}\n`,
      `\t\t/* Grayed */`,
      `\t\t.grayed{`,
      `\t\t\tcolor: #6D6D6D;`,
      `\t\t\tfilter: grayscale(100%);`,
      `\t\t}`,
      `\t\t.grayedLevel{`,
      `\t\t\tbackground: #474747;`,
      `\t\t}`,
      `\t\t.noMilestones{`,
      `\t\tfont-size: 20px;`,
      `\t\tfont-weight: 600;`,
      `\t\ttext-align: center;`,
      `\t\t}`,
      `\t</style>`,
      `\t<body>`,
      `\t\t<h1>Milestones</h1>`,
      `\t\t<div class="keys">Keys:</div>`,
      `\t\t<div class="top-levels level1">`,
      `\t\t\tLevel 1`,
      `\t\t</div>`,
      `\t\t<div class="top-levels level2">`,
      `\t\t\tLevel 2`,
      `\t\t</div>`,
      `\t\t<div class="top-levels level3">`,
      `\t\t\tLevel 3`,
      `\t\t</div>`,
      `\t\t<div class="top-levels level4">`,
      `\t\t\tLevel 4`,
      `\t\t</div>`,
      `\t\t<div class="top-levels level5">`,
      `\t\t\tLevel 5`,
      `\t\t</div>`,
      `\t\t<div class="top-levels level6">`,
      `\t\t\tLevel <span class="inf">∞</span>`,
      `\t\t</div>\n`,
    ].join("\n");

    // for calculating recents
    const date = Date.now();

    // for adding to the html string later
    var recents: string = "";
    var allMilestones: string = "\n\t\t<hr>\n\t\t<h2>All Milestones</h2>\n";

    // share icon
    const shareIcon =
      "https://100-days-of-code.s3-us-west-1.amazonaws.com/Milestones/share.svg";

    for (var i = 0; i < milestones.length; i++) {
      const milestone = milestones[i];
      const title: string = milestone.title;
      const description: string = milestone.description;
      const level: number = milestone.level;
      const achieved: boolean = milestone.achieved;
      var icon: string;
      var dateAchieved: number = 0;
      const shareLink = milestoneShareUrlGenerator(i + 1, title, description);
      // If achieved, card must be colored. Otherwise, card should be gray

      // for adding gray scale effect class into html
      var grayedCard: string = "";
      var grayedLevel: string = "";

      // can only share if achieved
      var shareHtml: string = "";

      // can only have date if achieved
      var dateHtml: string = "";

      // Re: If achieved, card must be colored. Otherwise, card should be gray
      if (achieved) {
        icon = milestone.icon;
        dateAchieved = milestone.date_achieved;
        shareHtml = `\t\t\t<a href="${shareLink}"><img src="${shareIcon}" class="milestoneShare"/></a>`;

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
      var levelHtml: string = "";
      if (level > 0 && level < 6) {
        levelHtml = `\t\t\t<div class="level${level} milestoneCardLevel ${grayedLevel}">Level ${level}</div>`;
      } else if (level === 6) {
        levelHtml = `\t\t\t<div class="level${level} milestoneCardLevel ${grayedLevel}">Level <span class="inf">∞</span></div>`;
      }

      const milestoneCardHtml: string = [
        `\t\t<div class="milestoneCard ${grayedCard}">`,
        `${levelHtml}`,
        `${shareHtml}`,
        `\t\t\t<div class="milestoneTitle">${title}</div>`,
        `\t\t\t<img class="logo" src=${icon} alt="Connect internet to view this really cool logo!">`,
        `\t\t\t<div class="milestoneDesc">${description}</div>`,
        `${dateHtml}`,
        `\t\t</div>\n`,
      ].join("\n");

      // Within a week of today
      if (date - dateAchieved < 604800001) {
        if (recents === "") {
          recents += `\n\t\t<h2>Recents</h2>\n`;
        }
        recents += milestoneCardHtml;
      }

      allMilestones += milestoneCardHtml;
    }

    // If no milestones earned within a week
    if (recents === "") {
      recents += `\n\t\t<h2>Recents</h2>\n`;
      recents += `\t\t<div class="noMilestones">No Milestones in the Past Week</div>\n`;
    }

    // adding recent and all milestones to html
    htmlString += recents;
    htmlString += allMilestones;

    // end
    htmlString += `\t</body>\n</html>`;
    return htmlString;
  }
}
export function updateMilestonesHtml() {
  let filepath = getMilestonesHtml();
  try {
    fs.writeFileSync(filepath, getUpdatedMilestonesHtmlString());
  } catch (err) {
    console.log(err);
  }
}
