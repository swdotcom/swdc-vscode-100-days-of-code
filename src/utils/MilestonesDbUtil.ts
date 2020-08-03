import { serverIsAvailable, softwareGet, isResponseOk, softwarePost, softwarePut } from "../managers/HttpManager";
import { getSoftwareDir, isWindows, getItem } from "./Util";
import { compareWithLocalMilestones, getMilestonesByDate, checkIfMilestonesAchievedOnDate } from "./MilestonesUtil";
import { getDayNumberFromDate } from "./LogsUtil";
import fs = require("fs");
import { current_round } from "./SummaryUtil";

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
    try {
        if (fs.existsSync(filepath)) {
            const payloadData = JSON.parse(fs.readFileSync(filepath).toString());
            updatedMilestonesDb = payloadData["updatedMilestonesDb"];
            sentMilestonesDb = payloadData["sentMilestonesDb"];
            toCreateMilestones = payloadData["toCreateMilestones"];
            toUpdateMilestones = payloadData["toUpdateMilestones"];
        }
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

export async function fetchMilestonesByDate(date: number): Promise<Array<number>> {
    const jwt = getItem("jwt");
    if (jwt) {
        // End Date Time is 11:59:59 pm
        let endDate = new Date(date);
        endDate.setHours(23, 59, 59, 0);

        // Start Date Time is 12:00:01 am
        let startDate = new Date(endDate.valueOf() - 68400000);
        startDate.setHours(0, 0, 1, 0);
        let available = false;
        try {
            available = await serverIsAvailable();
        } catch (err) {
            available = false;
        }
        if (available) {
            const milestones = await softwareGet(
                `/100doc/milestones?start_date=${Math.round(startDate.valueOf() / 1000)}&end_date=${Math.round(
                    endDate.valueOf() / 1000
                )}&challenge_round=${current_round}`,
                jwt
            ).then(resp => {
                if (isResponseOk(resp)) {
                    return resp.data;
                }
            });
            if (milestones) {
                // checking if milestones are sent. if not, return empty array
                if (milestones.length > 1) {
                    return milestones[0].milestones;
                } else {
                    return [];
                }
            }
        }
    }
    return [];
}

export async function fetchMilestonesForYesterdayAndToday() {
    const jwt = getItem("jwt");
    if (jwt) {
        // End Date is 11:59:59 pm today
        let endDate = new Date();
        endDate.setHours(23, 59, 59, 0);

        // Start Date is 12:00:01 am yesterday
        let startDate = new Date(endDate.valueOf() - 68400000 * 2);
        startDate.setHours(0, 0, 1, 0);
        let available = false;
        try {
            available = await serverIsAvailable();
        } catch (err) {
            available = false;
        }
        if (available) {
            const milestones = await softwareGet(
                `/100doc/milestones?start_date=${Math.round(startDate.valueOf() / 1000)}&end_date=${Math.round(
                    endDate.valueOf() / 1000
                )}&challenge_round=${current_round}`,
                jwt
            ).then(resp => {
                if (isResponseOk(resp)) {
                    return resp.data;
                }
            });
            if (milestones) {
                compareWithLocalMilestones(milestones);
            }
        }
    }
}

export async function fetchAllMilestones() {
    const jwt = getItem("jwt");
    if (jwt) {
        let available = false;
        try {
            available = await serverIsAvailable();
        } catch (err) {
            available = false;
        }
        if (available) {
            const milestones = await softwareGet(`/100doc/milestones?challenge_round=${current_round}`, jwt).then(
                resp => {
                    if (isResponseOk(resp)) {
                        return resp.data;
                    }
                }
            );
            if (milestones) {
                compareWithLocalMilestones(milestones);
            }
        }
    }
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
        milestones,
        challenge_round: current_round
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
