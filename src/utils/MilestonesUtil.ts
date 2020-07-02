import { getSoftwareDir, isWindows, compareDates } from "./Util";
import fs = require("fs");
import { window, commands } from "vscode";
import path = require("path");
import { updateLogsMilestonesAndMetrics, setDailyMilestonesByDayNumber, updateLogMilestonesByDates } from "./LogsUtil";
import { Summary } from "../models/Summary";
import {
    getSummaryObject,
    updateSummaryMilestones,
    incrementSummaryShare,
    updateSummaryLanguages
} from "./SummaryUtil";
import { getSessionCodetimeMetrics } from "./MetricUtil";
import { getLanguages } from "./LanguageUtil";
import { pushMilestonesToDb } from "./MilestonesDbUtil";
import { HOURS_THRESHOLD } from "./Constants";

function getMilestonesJson(): string {
    let file = getSoftwareDir();
    if (isWindows()) {
        file += "\\milestones.json";
    } else {
        file += "/milestones.json";
    }
    return file;
}

export function checkMilestonesJson(): boolean {
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

export function getMilestonesByDate(date: number): Array<number> {
    // checks if date is sent is in the future
    const dateOb = new Date(date);
    const dateNowOb = new Date();
    const dateNow = dateNowOb.valueOf();
    if (dateNow < date) {
        return [];
    }

    // finds milestones achieved on date give and returns them
    const sendMilestones: Array<number> = [];
    let milestones = getAllMilestones();
    for (let i = 0; i < milestones.length; i++) {
        if (milestones[i].achieved && compareDates(new Date(milestones[i].date_achieved), dateOb)) {
            sendMilestones.push(milestones[i].id);
        }
    }
    return sendMilestones;
}

export function compareWithLocalMilestones(dbMilestones: any) {
    // goes through each milestone and updates based on db data
    let milestones = getAllMilestones();
    let dates = [];
    for (let i = 0; i < dbMilestones.length; i++) {
        const dbMilestonesLocalDate = dbMilestones[i].local_date * 1000;
        const dbDateOb = new Date(dbMilestonesLocalDate);
        const dbMilestonesArray: Array<number> = dbMilestones[i].milestones;
        let toAddDailyMilestones = [];
        for (let j = 0; j < dbMilestonesArray.length; j++) {
            const currMilestone = milestones[dbMilestonesArray[j] - 1];
            if (currMilestone.achieved && !compareDates(dbDateOb, new Date(currMilestone.date_achieved))) {
                // Daily Milestones will not update
                if (
                    (currMilestone.id > 18 && currMilestone.id < 25) ||
                    (currMilestone.id > 48 && currMilestone.id < 57)
                ) {
                    toAddDailyMilestones.push(currMilestone.id);
                    if (dbMilestonesLocalDate > currMilestone.date_achieved) {
                        dates.push(dbMilestonesLocalDate, currMilestone.date_achieved);
                        milestones[currMilestone.id - 1].date_achieved = dbMilestonesLocalDate;
                    }
                } else if (dbMilestonesLocalDate < currMilestone.date_achieved) {
                    dates.push(dbMilestonesLocalDate, currMilestone.date_achieved);
                    milestones[currMilestone.id - 1].date_achieved = dbMilestonesLocalDate;
                } else if (dbMilestonesLocalDate > currMilestone.date_achieved) {
                }
            } else if (!currMilestone.achieved) {
                dates.push(dbMilestonesLocalDate);
                milestones[currMilestone.id - 1].achieved = true;
                milestones[currMilestone.id - 1].date_achieved = dbMilestonesLocalDate;
            }
        }
        if (toAddDailyMilestones.length > 0) {
            setDailyMilestonesByDayNumber(dbMilestones[i].day_number, toAddDailyMilestones);
        }
    }

    if (dates.length > 0) {
        writeToMilestoneJson(milestones);

        // updates logs milestones
        updateLogMilestonesByDates(dates);
    }
}

export function checkIfMilestonesAchievedOnDate(date: number): boolean {
    const dateData = new Date(date);
    let milestones = getAllMilestones();
    let count = 0;
    for (let i = 0; i < milestones.length; i++) {
        if (milestones[i].achieved && compareDates(new Date(milestones[i].date_achieved), dateData)) {
            count++;
            // ensures that more than one milestone was achieved that day
            if (count > 1) {
                return true;
            }
        }
    }
    return false;
}

export function checkCodeTimeMetricsMilestonesAchieved(): void {
    let achievedMilestones = [];
    const summary: Summary = getSummaryObject();

    // metrics of form [minutes, keystrokes, lines]
    const codeTimeMetrics = getSessionCodetimeMetrics();

    // prev code time users already have some metrics that
    // need to be taken into account for the day
    const onboarding = summary.days <= 1;

    // check for aggregate codetime
    const aggHours = summary.hours + codeTimeMetrics.minutes / 60;
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
    const dayHours = codeTimeMetrics.minutes / 60;
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
    const lines = summary.lines_added + codeTimeMetrics.linesAdded;
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
    const keystrokes = summary.keystrokes + codeTimeMetrics.keystrokes;
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

    if (achievedMilestones.length > 0) {
        achievedMilestonesJson(achievedMilestones);
    }
}

export function checkLanguageMilestonesAchieved(): void {
    updateSummaryLanguages();
    const summary: Summary = getSummaryObject();
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
        achievedMilestonesJson(milestonesAchieved);
    }
}

export function checkDaysMilestones(): void {
    const summary: Summary = getSummaryObject();

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
        achievedMilestonesJson(achievedMilestones);
    }
}

export function checkSharesMilestones(): void {
    const summary: Summary = getSummaryObject();
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

export function getMilestoneById(id: number) {
    if (!checkIdRange(id)) {
        return {};
    }
    let milestones = getAllMilestones();
    return milestones[id - 1];
}

function achievedMilestonesJson(ids: Array<number>): void {
    let updatedIds = [];
    let milestones = getAllMilestones();
    const dateNow = new Date();
    for (let i = 0; i < ids.length; i++) {
        const id = ids[i];

        // Usually would never be triggered
        if (!checkIdRange(id)) {
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
                window
                    .showInformationMessage(
                        "Whoa! You just unlocked the #100DaysOfCode Certificate. Please view it on the 100 Days of Code Dashboard.",
                        {
                            modal: true
                        },
                        "View Dashboard"
                    )
                    .then(selection => {
                        if (selection === "View Dashboard") {
                            commands.executeCommand("DoC.viewDashboard");
                        }
                    });
            }
            updatedIds.push(id);
        }
    }

    if (updatedIds.length > 0) {
        // updates logs
        updateLogsMilestonesAndMetrics(updatedIds);

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

        // updates db
        pushMilestonesToDb(dateNow.valueOf(), updatedIds);

        window
            .showInformationMessage("Hurray! You just achieved another milestone.", "View Milestones")
            .then(selection => {
                if (selection === "View Milestones") {
                    commands.executeCommand("DoC.viewMilestones");
                }
            });
    }
}

export function updateMilestoneShare(id: number) {
    if (!checkIdRange(id)) {
        return;
    }
    let milestones = getAllMilestones();

    // check and update milestones if not shared
    if (!milestones[id - 1].shared) {
        milestones[id - 1].shared = true;
        writeToMilestoneJson(milestones);
        incrementSummaryShare();
        checkSharesMilestones();
    }
}

export function getTotalMilestonesAchieved(): number {
    const milestones = getAllMilestones();

    let totalMilestonesAchieved = 0;
    for (let milestone of milestones) {
        if (milestone.achieved) {
            totalMilestonesAchieved++;
        }
    }
    return totalMilestonesAchieved;
}

export function getAllMilestones(): Array<any> {
    // Checks if the file exists and if not, creates a new file
    const exists = checkMilestonesJson();
    if (!exists) {
        window.showErrorMessage("Cannot access Milestone file! Please contact cody@software.com for help.");
        return [];
    }
    const filepath = getMilestonesJson();
    let rawMilestones = fs.readFileSync(filepath).toString();
    let milestones = JSON.parse(rawMilestones).milestones;
    return milestones;
}

export function getThreeMostRecentMilestones(): Array<number> {
    let milestones: Array<any> = getAllMilestones();
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

function writeToMilestoneJson(milestones: Array<any>) {
    const filepath = getMilestonesJson();
    let sendMilestones = { milestones };
    try {
        fs.writeFileSync(filepath, JSON.stringify(sendMilestones, null, 4));
    } catch (err) {
        console.log(err);
    }
}
