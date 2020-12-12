import { compareDates } from "./Util";
import fs = require("fs");
import { window, commands } from "vscode";
import path = require("path");
import { Summary } from "../models/Summary";
import { updateSummaryMilestones, incrementSummaryShare, updateSummaryLanguages } from "./SummaryUtil";
import { getLanguages } from "./LanguageUtil";
import { HOURS_THRESHOLD } from "./Constants";
import { Milestone } from "../models/Milestone";
import { getFile, getFileDataAsJson, fetchSummaryJsonFileData } from "../managers/FileManager";

function getMilestonesJsonFilePath(): string {
    return getFile("milestones.json");
}

export function checkMilestonesJson(): boolean {
    const filePath = getMilestonesJsonFilePath();
    if (!fs.existsSync(filePath)) {
        try {
            const src = path.join(__dirname, "/assets/milestones.json");
            // const src = path.join(__dirname, "../assets/milestones.json");
            fs.copyFileSync(src, filePath);
        } catch (e) {
            return false;
        }
    }
    return true;
}

export function deleteMilestoneJson() {
    const filepath = getMilestonesJsonFilePath();
    const fileExists = fs.existsSync(filepath);
    if (fileExists) {
        fs.unlinkSync(filepath);
    }
}

export function getTodaysLocalMilestones(): Array<number> {
    const now = new Date();

    // finds milestones achieved on date give and returns them
    const sendMilestones: Array<number> = [];
    const milestoneData = getAllMilestones();
    if (milestoneData && milestoneData.milestones) {
        const milestones = milestoneData.milestones;
        for (let i = 0; i < milestones.length; i++) {
            if (milestones[i].achieved && compareDates(new Date(milestones[i].date_achieved), now)) {
                sendMilestones.push(milestones[i].id);
            }
        }
    }
    return sendMilestones;
}

export function compareWithLocalMilestones(serverMilestones: any) {
    // get the local copy of the milestones and update the attributes
    const localMilestoneData = getAllMilestones();
    const milestones = localMilestoneData.milestones || [];

    const hasServerMilestones = (serverMilestones && serverMilestones.length);
    for (let milestone of milestones) {
        if (hasServerMilestones) {
            const serverMilestone = serverMilestones.find((n:any) => n.milestones.includes(milestone.id));
            if (serverMilestone) {
                milestone.date_achieved = new Date(serverMilestone.unix_date * 1000);
                milestone["day_number"] = serverMilestone.day_number;
                milestone.achieved = true;
            }
        }
    }

    writeToMilestoneJson(milestones);
}

export function checkIfMilestonesAchievedOnDate(date: number): boolean {
    const dateData = new Date(date);
    let milestonesData = getAllMilestones();
    let count = 0;
    if (milestonesData && milestonesData.milestones) {
        const milestones = milestonesData.milestones;
        for (let i = 0; i < milestones.length; i++) {
            if (milestones[i].achieved && compareDates(new Date(milestones[i].date_achieved), dateData)) {
                count++;
                // ensures that more than one milestone was achieved that day
                if (count > 1) {
                    return true;
                }
            }
        }
    }
    return false;
}

export function checkCodeTimeMetricsMilestonesAchieved(): Array<number> {
    let achievedMilestones = [];
    const summary: Summary = fetchSummaryJsonFileData();

    // check for aggregate codetime
    const aggHours = summary.hours + summary.currentHours;
    if (aggHours >= 200) {
        achievedMilestones.push(6, 5, 4, 3, 2, 1);
    } else if (aggHours >= 120) {
        achievedMilestones.push(5, 4, 3, 2, 1);
    } else if (aggHours >= 90) {
        achievedMilestones.push(4, 3, 2, 1);
    } else if (aggHours >= 60) {
        achievedMilestones.push(3, 2, 1);
    } else if (aggHours >= 30) {
        achievedMilestones.push(2, 1);
    } else if (aggHours >= 1) {
        achievedMilestones.push(1);
    }

    // check for daily codetime. These will be given out daily
    const dayHours = summary.currentHours;
    if (dayHours >= 10) {
        achievedMilestones.push(24, 23, 22, 21, 20, 19);
    } else if (dayHours >= 8) {
        achievedMilestones.push(23, 22, 21, 20, 19);
    } else if (dayHours >= 5) {
        achievedMilestones.push(22, 21, 20, 19);
    } else if (dayHours >= 3) {
        achievedMilestones.push(21, 20, 19);
    } else if (dayHours >= 2) {
        achievedMilestones.push(20, 19);
    } else if (dayHours >= 1) {
        achievedMilestones.push(19);
    }

    // check for lines added
    const lines = summary.lines_added + summary.currentLines;
    if (lines >= 10000) {
        achievedMilestones.push(30, 29, 28, 27, 26, 25);
    } else if (lines >= 1000) {
        achievedMilestones.push(29, 28, 27, 26, 25);
    } else if (lines >= 100) {
        achievedMilestones.push(28, 27, 26, 25);
    } else if (lines >= 50) {
        achievedMilestones.push(27, 26, 25);
    } else if (lines >= 16) {
        achievedMilestones.push(26, 25);
    } else if (lines >= 1) {
        achievedMilestones.push(25);
    }

    // check for keystrokes
    const keystrokes = summary.keystrokes + summary.currentKeystrokes;
    if (keystrokes >= 42195) {
        achievedMilestones.push(42, 41, 40, 39, 38, 37);
    } else if (keystrokes >= 21097) {
        achievedMilestones.push(41, 40, 39, 38, 37);
    } else if (keystrokes >= 10000) {
        achievedMilestones.push(40, 39, 38, 37);
    } else if (keystrokes >= 5000) {
        achievedMilestones.push(39, 38, 37);
    } else if (keystrokes >= 1000) {
        achievedMilestones.push(38, 37);
    } else if (keystrokes >= 100) {
        achievedMilestones.push(37);
    }

    if (achievedMilestones.length) {
        return achievedMilestonesJson(achievedMilestones);
    }
    return [];
}

export function checkLanguageMilestonesAchieved(): Array<number> {
    updateSummaryLanguages();
    const summary: Summary = fetchSummaryJsonFileData();
    const languages = getLanguages();
    let milestones: Set<number> = new Set<number>();

    // single language check
    let language: string;
    for (language of languages) {
        switch (language) {
            case "c":
            case "cpp":
                milestones.add(51);
                break;
            case "html":
            case "css":
                milestones.add(54);
                break;
            case "javascript":
            case "javascriptreact":
                milestones.add(52);
                break;
            case "json":
            case "jsonc":
                milestones.add(55);
                break;
            case "java":
                milestones.add(49);
                break;
            case "plaintext":
                milestones.add(53);
                break;
            case "python":
                milestones.add(50);
                break;
            case "typescript":
            case "typescriptreact":
                milestones.add(56);
                break;
        }
    }

    // multi language check
    switch (summary.languages.length) {
        default:
        case 6:
            milestones.add(48);
        case 5:
            milestones.add(47);
        case 4:
            milestones.add(46);
        case 3:
            milestones.add(45);
        case 2:
            milestones.add(44);
        case 1:
            milestones.add(43);
        case 0:
            break;
    }

    const milestonesAchieved = Array.from(milestones);
    if (milestonesAchieved.length > 0) {
        return achievedMilestonesJson(milestonesAchieved);
    }
    return [];
}

export function checkDaysMilestones(): Array<number> {
    const summary: Summary = fetchSummaryJsonFileData();

    let days = summary.days;
    let streaks = summary.longest_streak;

    // curr day is completed only after a certain threshold hours are met
    // no checks for prev day
    if (summary.currentHours < HOURS_THRESHOLD) {
        days--;
        streaks--;
    }
    let achievedMilestones = [];

    // checking for days
    if (days >= 110) {
        achievedMilestones.push(12);
    } else if (days >= 100) {
        achievedMilestones.push(11);
    } else if (days >= 75) {
        achievedMilestones.push(10);
    } else if (days >= 50) {
        achievedMilestones.push(9);
    } else if (days >= 10) {
        achievedMilestones.push(8);
    } else if (days >= 1) {
        achievedMilestones.push(7);
    }

    // checking for streaks
    if (streaks >= 100) {
        achievedMilestones.push(18);
    } else if (streaks >= 60) {
        achievedMilestones.push(17);
    } else if (streaks >= 30) {
        achievedMilestones.push(16);
    } else if (streaks >= 14) {
        achievedMilestones.push(15);
    } else if (streaks >= 7) {
        achievedMilestones.push(14);
    } else if (streaks >= 2) {
        achievedMilestones.push(13);
    }

    if (achievedMilestones.length > 0) {
        return achievedMilestonesJson(achievedMilestones);
    }
    return [];
}

export function checkSharesMilestones(): void {
    const summary: Summary = fetchSummaryJsonFileData();
    const shares = summary.shares;

    if (shares >= 100) {
        achievedMilestonesJson([36]);
    } else if (shares >= 50) {
        achievedMilestonesJson([35]);
    } else if (shares >= 21) {
        achievedMilestonesJson([34]);
    } else if (shares >= 10) {
        achievedMilestonesJson([33]);
    } else if (shares >= 5) {
        achievedMilestonesJson([32]);
    } else if (shares >= 1) {
        achievedMilestonesJson([31]);
    }
}

export function checkIfDaily(id: number): boolean {
    if ((id > 18 && id < 25) || (id > 48 && id < 57)) {
        return true;
    }
    return false;
}

function checkIdRange(id: number): boolean {
    const MIN_ID = 1;
    const MAX_ID = 56;

    if (id >= MIN_ID && id <= MAX_ID) {
        return true;
    }
    window.showErrorMessage("Incorrect Milestone Id! Please contact cody@software.com for help.");
    return false;
}

export function getMilestoneById(id: number): Milestone | any {
    if (!checkIdRange(id)) {
        return {};
    }
    const milestoneData = getAllMilestones();
    return milestoneData && milestoneData.milestones ? milestoneData.milestones.find((n: any) => n.id === id) : null;
}

function achievedMilestonesJson(ids: Array<number>): Array<number> {
    let updatedIds = [];
    const milestonesData = getAllMilestones();
    const milestones = milestonesData.milestones || [];
    const dateNow = new Date();
    for (let id of ids) {

        // Usually would never be triggered
        if (!checkIdRange(id) || !milestones[id - 1]) {
            continue;
        }

        // Updates daily - daily time and languages
        if ((id > 18 && id < 25) || (id > 48 && id < 57)) {
            const dateOb = new Date(milestones[id - 1].date_achieved);
            // Updates only if it wasn't achieved that day
            if (!compareDates(dateOb, dateNow)) {
                milestones[id - 1].achieved = true; // id is indexed starting 1
                milestones[id - 1].date_achieved = dateNow.valueOf();
                updatedIds.push(id);
            }
        }

        // If no date entry for the milestone has been made
        else if (!(milestones[id - 1].date_achieved && milestones[id - 1].date_achieved > 0)) {
            milestones[id - 1].achieved = true; // id is indexed starting 1
            milestones[id - 1].date_achieved = dateNow.valueOf();
            // For certificate
            if (id === 11) {
                const title = "View Dashboard";
                const msg = "Whoa! You just unlocked the #100DaysOfCode Certificate. Please view it on the 100 Days of Code Dashboard.";
                const commandCallback = "DoC.viewDashboard";
                commands.executeCommand("DoC.showInfoMessage", title, msg, true /*isModal*/, commandCallback);
            }
            updatedIds.push(id);
        }
    }

    if (updatedIds.length) {
        // updates summary
        let totalMilestonesAchieved = 0;
        for (let i = 0; i < milestones.length; i++) {
            if (milestones[i].achieved) {
                totalMilestonesAchieved++;
            }
        }
        updateSummaryMilestones(updatedIds, totalMilestonesAchieved);

        // write to milestones file
        writeToMilestoneJson(milestones);

        const title = "View Milestones";
        const msg = "Hurray! You just achieved another milestone.";
        const commandCallback = "DoC.viewMilestones";
        commands.executeCommand("DoC.showInfoMessage", title, msg, false /*isModal*/, commandCallback);
        return updatedIds;
    }
    return [];
}

export function updateMilestoneShare(id: number): void {
    if (!checkIdRange(id)) {
        return;
    }
    let milestones = getAllMilestones();

    // check and update milestones if not shared
    if (milestones && milestones.length && milestones[id - 1] && !milestones[id - 1].shared) {
        milestones[id - 1].shared = true;
        writeToMilestoneJson(milestones);
        incrementSummaryShare();
    }
}

export function getTotalMilestonesAchieved(): number {
    const milestoneData = getAllMilestones();
    const milestones = milestoneData.milestones || [];
    let totalMilestonesAchieved = 0;
    for (let milestone of milestones) {
        if (milestone.achieved) {
            totalMilestonesAchieved++;
        }
    }
    return totalMilestonesAchieved;
}

/**
 * This returns the milestones data
 * {milestones: []}
 */
export function getAllMilestones(): any {
    // Checks if the file exists and if not, creates a new file
    if (!checkMilestonesJson()) {
        window.showErrorMessage("Cannot access Milestone file! Please contact cody@software.com for help.");
        return { milestones: [] };
    }
    const filepath = getMilestonesJsonFilePath();
    const milestoneData = getFileDataAsJson(filepath);
    return milestoneData || { milestones: [] };
}

export function getThreeMostRecentMilestones(): Array<number> {
    const milestoneData = getAllMilestones();
    const milestones = milestoneData.milestones || [];
    milestones.sort((a: any, b: any) => {
        // sorting in descending order of date_achieved
        if (a.achieved && b.achieved) {
            return b.date_achieved - a.date_achieved;
        } else if (a.achieved) {
            return -1;
        } else if (b.achieved) {
            return 1;
        } else {
            return 0;
        }
    });
    let sendMilestones: Array<number> = [];
    const rawSendMilestones = milestones.slice(0, 3);
    rawSendMilestones.forEach((milestone: any) => {
        if (milestone.achieved) {
            sendMilestones.push(milestone.id);
        }
    });
    return sendMilestones;
}

function writeToMilestoneJson(milestones: Array<Milestone>) {
    const filepath = getMilestonesJsonFilePath();
    let sendMilestones = { milestones };
    try {
        fs.writeFileSync(filepath, JSON.stringify(sendMilestones, null, 2));
    } catch (err) {
        console.log(err);
    }
}
