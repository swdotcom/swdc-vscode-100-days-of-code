import { serverIsAvailable, softwareGet, isResponseOk, softwarePost, softwarePut } from "../managers/HttpManager";
import { getSoftwareDir, isWindows, getItem, getFileDataAsJson } from "./Util";
import { compareWithLocalMilestones, getMilestonesByDate, checkIfMilestonesAchievedOnDate } from "./MilestonesUtil";
import { getDayNumberFromDate } from "./LogsUtil";
import fs = require("fs");

// variables to keep in check the db update process
export let updatedMilestonesDb = true;
export let sentMilestonesDb = true;

let toCreateMilestones: Array<any> = [];
let toUpdateMilestones: Array<any> = [];

function getMilestonesPayloadJson(): string {
    let file = getSoftwareDir();
    if (isWindows()) {
        file += "\\milestonesPayload.json";
    } else {
        file += "/milestonesPayload.json";
    }
    return file;
}

export function createMilestonesPayloadJson() {
    const filepath = getMilestonesPayloadJson();
    const fileData = {
        updatedMilestonesDb,
        sentMilestonesDb,
        toCreateMilestones,
        toUpdateMilestones
    };
    try {
        fs.writeFileSync(filepath, JSON.stringify(fileData, null, 4));
    } catch (err) {
        console.log(err);
    }
}

export function checkMilestonesPayload() {
    const filepath = getMilestonesPayloadJson();
    const payloadData = getFileDataAsJson(filepath, {});
    try {
        updatedMilestonesDb = payloadData["updatedMilestonesDb"];
        sentMilestonesDb = payloadData["sentMilestonesDb"];
        toCreateMilestones = payloadData["toCreateMilestones"];
        toUpdateMilestones = payloadData["toUpdateMilestones"];
    } catch (err) {
        console.log(err);
    }
}

export function deleteMilestonePayloadJson() {
    const filepath = getMilestonesPayloadJson();
    const fileExists = fs.existsSync(filepath);
    if (fileExists) {
        fs.unlinkSync(filepath);
    }
}

/**
 *
 * @param date a date value (timestamp or date string)
 * @param fetchAll whether to fetch all time or for a shorter time period
 */
export async function fetchMilestones(date: number = 0, fetchAll: boolean = false): Promise<Array<number>> {
    let milestones: any[] = [];
    const jwt = getItem("jwt");
    if (!jwt) {
        return milestones;
    }

    // check if service is available
    let available = false;
    try {
        available = await serverIsAvailable();
    } catch (err) {
        available = false;
    }
    if (!available) {
        return milestones;
    }

    // get the milestones from the server
    if (fetchAll) {
        await softwareGet("/100doc/milestones", jwt).then(resp => {
            if (isResponseOk(resp)) {
                milestones = resp.data;
            }
        });
    } else {
        const ONE_DAY_SEC = 68400000;
        // default to today and yesterday
        let endDate = new Date(); // 11:59:59 pm today
        let startDate = new Date(endDate.valueOf() - ONE_DAY_SEC * 2); // 12:00:01 am yesterday

        if (date) {
            endDate = new Date(date); // 11:59:59 pm today
            startDate = new Date(endDate.valueOf() - ONE_DAY_SEC); // 12:00:01 am yesterday
        }
        // normalize dates
        startDate.setHours(0, 0, 1, 0);
        endDate.setHours(23, 59, 59, 0);

        // query params
        const start_date = Math.round(startDate.valueOf() / 1000);
        const end_date = Math.round(endDate.valueOf() / 1000);

        await softwareGet(`/100doc/milestones?start_date=${start_date}&end_date=${end_date}`, jwt).then(resp => {
            if (isResponseOk(resp)) {
                milestones = resp.data;
            }
        });
    }

    // sync with local
    if (milestones.length > 0) {
        compareWithLocalMilestones(milestones);
    }

    // return milestones
    return milestones;
}

export function pushMilestonesToDb(date: number, milestones: Array<number>) {
    // handles creating and updating of milestones and adds milestones accordingly
    const dateData = new Date(date);
    const update: boolean = checkIfMilestonesAchievedOnDate(date);
    if (update) {
        // Takes into check new milestones and old ones
        milestones = getMilestonesByDate(date);
    }
    const offset_minutes = dateData.getTimezoneOffset();
    const day_number = getDayNumberFromDate(date);
    const sendMilestones = {
        day_number,
        unix_date: Math.round(date / 1000), // milliseconds --> seconds
        local_date: Math.round(date / 1000) - offset_minutes * 60, // milliseconds --> seconds,
        offset_minutes,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        milestones
    };

    // handles update and create
    if (update) {
        toUpdateMilestones.push(sendMilestones);
        pushUpdatedMilestones();
    } else {
        toCreateMilestones.push(sendMilestones);
        pushNewMilestones();
    }
}

export async function pushNewMilestones() {
    const jwt = getItem("jwt");
    if (jwt) {
        let available = false;
        try {
            available = await serverIsAvailable();
        } catch (err) {
            available = false;
        }
        if (available) {
            const resp = await softwarePost("/100doc/milestones", toCreateMilestones, jwt);
            const added: boolean = isResponseOk(resp);
            if (!added) {
                sentMilestonesDb = false;
            } else {
                sentMilestonesDb = true;
                toCreateMilestones = [];
                return;
            }
        } else {
            sentMilestonesDb = false;
        }
    } else {
        sentMilestonesDb = false;
    }
}

export async function pushUpdatedMilestones() {
    const jwt = getItem("jwt");
    if (jwt) {
        // try to post new milestones before sending updated
        // milestones as the edits might be on the non posted milestones
        if (!sentMilestonesDb) {
            await pushNewMilestones();
        }
        let available = false;
        try {
            available = await serverIsAvailable();
        } catch (err) {
            available = false;
        }
        if (available) {
            const resp = await softwarePut("/100doc/milestones", toUpdateMilestones, jwt);
            const added: boolean = isResponseOk(resp);
            if (!added) {
                updatedMilestonesDb = false;
            } else {
                updatedMilestonesDb = true;
                toUpdateMilestones = [];
                return;
            }
        } else {
            updatedMilestonesDb = false;
        }
    } else {
        updatedMilestonesDb = false;
    }
}
