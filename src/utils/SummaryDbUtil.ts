import { compareLocalSummary } from "./SummaryUtil";
import { Summary } from "../models/Summary";
import { serverIsAvailable, softwarePost, softwarePut, softwareGet, isResponseOk } from "../managers/HttpManager";
import { getItem } from "./Util";
import fs = require("fs");
import { getSummaryJsonFilePath, fetchSummaryJsonFileData } from "../managers/FileManager";

export async function pushSummaryToDb() {
    // checks if summary exists and updates/creates it
    if (!fs.existsSync(getSummaryJsonFilePath())) {
        pushNewSummary();
    } else {
        pushUpdatedSummary();
    }
}

async function pushNewSummary() {
    // get the summary from the JSON
    const summary: Summary = fetchSummaryJsonFileData();

    // convert the summary object to the db style object
    const toCreateSummary = {
        days: summary.days,
        minutes: summary.hours * 60,
        keystrokes: summary.keystrokes,
        lines_added: summary.lines_added,
        lines_removed: 0,
        longest_streak: summary.longest_streak,
        milestones: summary.milestones,
        shares: summary.shares,
        languages: summary.languages
    };
    const jwt = getItem("jwt");
    if (jwt) {
        let available = false;
        try {
            available = await serverIsAvailable();
        } catch (err) {
            available = false;
        }
        if (available) {
            const resp = await softwarePost("/100doc/summary", toCreateSummary, jwt);
        }
    }
}

export async function pushUpdatedSummary() {
    const summary: Summary = fetchSummaryJsonFileData();

    const toCreateSummary = {
        days: summary.days,
        minutes: summary.hours * 60,
        keystrokes: summary.keystrokes,
        lines_added: summary.lines_added,
        lines_removed: 0,
        longest_streak: summary.longest_streak,
        milestones: summary.milestones,
        shares: summary.shares,
        languages: summary.languages
    };

    const jwt = getItem("jwt");
    if (jwt) {
        softwarePut("/100doc/summary", toCreateSummary, jwt);
    }
}

export async function fetchSummary(): Promise<boolean> {
    const jwt = getItem("jwt");
    if (jwt) {
        let available = false;
        try {
            available = await serverIsAvailable();
        } catch (err) {
            available = false;
        }
        if (available) {
            const summary = await softwareGet("/100doc/summary", jwt).then(resp => {
                if (isResponseOk(resp) && resp.data) {
                    const rawSummary = resp.data;
                    let summary = {
                        days: rawSummary.days,
                        hours: rawSummary.minutes / 60,
                        keystrokes: rawSummary.keystrokes,
                        lines_added: rawSummary.lines_added,
                        longest_streak: rawSummary.longest_streak,
                        milestones: rawSummary.milestones,
                        shares: rawSummary.shares,
                        languages: rawSummary.languages
                    };
                    return summary;
                }
            });
            if (summary) {
                compareLocalSummary(summary);
                return true;
            }
        }
    }
    return false;
}
