import { softwareGet, isResponseOk, softwarePost, softwarePut } from "../managers/HttpManager";
import { getItem } from "./Util";
import { compareWithLocalMilestones, getMilestonesByDate, checkIfMilestonesAchievedOnDate } from "./MilestonesUtil";
import { getDayNumberFromDate } from "./LogsUtil";
import fs = require("fs");
import { getFileDataAsJson, getFile } from "../managers/FileManager";

// variables to keep in check the db update process
export let updatedMilestonesDb = true;
export let sentMilestonesDb = true;

let toCreateMilestones: Array<any> = [];
let toUpdateMilestones: Array<any> = [];

function getMilestonesPayloadJson(): string {
    return getFile("milestonesPayload.json");
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
        fs.writeFileSync(filepath, JSON.stringify(fileData, null, 2));
    } catch (err) {
        console.log(err);
    }
}

export function checkMilestonesPayload() {
    // default these to keep the loop running
    updatedMilestonesDb = false;
    sentMilestonesDb = false;
    toCreateMilestones = [];
    toUpdateMilestones = [];

    const filepath = getMilestonesPayloadJson();
    const payloadData = getFileDataAsJson(filepath);

    if (!payloadData) {
        // no milestonesPayload.json file
        return;
    }
    // if the object has less than the 4 keys below, it's been corrupted
    if (Object.keys(payloadData).length < 4) {
        console.log("Milestones object is empty");
        return;
    }

    // only update if there is payloadData
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
 * This will return an array of..
 * [{challenge_round, createdAt, day_number, local_date, milestones [numbers], offset_minutes, timezone, type, unix_date, userId}]
 * @param date
 */
export async function fetchMilestones(date: any = null): Promise<any> {
    const jwt = getItem("jwt");
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

    const milestoneData = await softwareGet(`/100doc/milestones?start_date=${start_date}&end_date=${end_date}`, jwt).then(resp => {
        if (isResponseOk(resp) && resp.data) {
            return resp.data;
        }
        return null;
    });

    // sync with local
    if (milestoneData) {
        compareWithLocalMilestones(milestoneData);
    }

    // return milestones
    return milestoneData;
}

/**
 * This will return an array of..
 * [{challenge_round, createdAt, day_number, local_date, milestones [numbers], offset_minutes, timezone, type, unix_date, userId}]
 * @param date a date value (timestamp or date string)
 * @param fetchAll whether to fetch all time or for a shorter time period
 */
export async function fetchAllMilestones(fetchAll: boolean = false): Promise<any> {
    const jwt = getItem("jwt");

    const milestoneData = await softwareGet("/100doc/milestones", jwt).then(resp => {
        if (isResponseOk(resp) && resp.data) {
            return resp.data;
        }
        return null;
    });

    // sync with local
    if (milestoneData) {
        compareWithLocalMilestones(milestoneData);
    }

    // return milestones
    return milestoneData;
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
}

export async function pushUpdatedMilestones() {
    const jwt = getItem("jwt");
    if (jwt) {
        // try to post new milestones before sending updated
        // milestones as the edits might be on the non posted milestones
        if (!sentMilestonesDb) {
            await pushNewMilestones();
        }

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
}
