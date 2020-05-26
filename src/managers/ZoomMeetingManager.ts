import { zoomGet, zoomPost } from "./HttpManager";
import { ZoomMeeting } from "../models/ZoomMeeting";
import { ZoomMeetingInfo } from "../models/ZoomMeetingInfo";
import { commands } from "vscode";
import { ZoomInfoManager } from "./ZoomInfoManager";
import { ZoomInfo } from "../models/ZoomInfo";
import { launchInputBox } from "../utils/Util";

const moment = require("moment-timezone");

export class ZoomMeetingManager {
    private static instance: ZoomMeetingManager;

    constructor() {}

    static getInstance(): ZoomMeetingManager {
        if (!ZoomMeetingManager.instance) {
            ZoomMeetingManager.instance = new ZoomMeetingManager();
        }

        return ZoomMeetingManager.instance;
    }

    async getMeetings(): Promise<ZoomMeeting[]> {
        let meetings: ZoomMeeting[] = [];
        // logged on, fetch the meetings
        const api = "/users/me/meetings";
        const resultData = await zoomGet(api);

        // data structure
        //
        // created_at:"2020-03-21T05:14:55Z"
        // duration:60
        // host_id:"pRzU_7_5THWk4c2Pp-C12A"
        // id:153543960
        // join_url:"https://zoom.us/j/153543960"
        // start_time:"2020-05-04T18:00:00Z"
        // timezone:"America/Los_Angeles"
        // topic:"Zoom Test Meeting 1"
        // type:8
        // uuid:"Q1vrFMZ9SWy3JXsGjUzh2A=="
        if (resultData && resultData.data) {
            meetings = resultData.data.meetings;

            // set the description basd on the type
            // 1 = instant, 2 = scheduled, 3 = recurring w/ no fixed time, 8 = recurring w/ fixed time
            meetings.forEach((meeting: ZoomMeeting) => {
                let momentTime: any;
                if (meeting.start_time) {
                    momentTime = moment(meeting.start_time);
                    meeting.start_time_seconds = momentTime.unix();

                    if (meeting.type === 8) {
                        const day = momentTime.format("ddd");
                        const time = momentTime.format("hh:mm a");
                        meeting.description = `Every ${day} at ${time}`;
                    } else if (meeting.type === 2) {
                        const date = momentTime.format("llll");
                        meeting.description = `${date}`;
                    }
                }
            });
        }

        return meetings;
    }

    async initiateCreateMeetingFlow() {
        let topic = await this.promptForTopic();
        if (!topic) {
            return;
        }

        let agenda = await this.promptForAgenda();
        if (!agenda) {
            return;
        }
        return await this.createMeeting(topic.trim(), agenda.trim());
    }

    private async promptForTopic() {
        return await launchInputBox(
            "Assign a topic to the meeting",
            "Please enter a non-empty topic to continue."
        );
    }

    private async promptForAgenda() {
        return await launchInputBox(
            "Assign an agenda to the meeting",
            "Please enter a non-empty agenda to continue."
        );
    }

    async createMeeting(topic: string, agenda: string) {
        let meetingInfo: ZoomMeetingInfo = new ZoomMeetingInfo();
        // type => 1 = instant, 2 = scheduled, 3 = recurring w/ no fixed time, 8 = recurring w/ fixed time
        const payload = {
            topic,
            type: 1 /* instant */,
            duration: 60 /* minutes */,
            agenda,
            settings: {
                approval_type: 0 /* automatically approve */,
                enforce_login: false,
                meeting_authentication: false
            }
        };

        const api = "/users/me/meetings";
        const resultData = await zoomPost(api, payload);

        if (resultData && resultData.data) {
            meetingInfo = resultData.data;
            commands.executeCommand("zoomtime.refreshMeetingTree");

            // create a bookmark out of it
            const zoomInfo: ZoomInfo = new ZoomInfo();
            zoomInfo.join_url = meetingInfo.join_url;
            zoomInfo.topic = meetingInfo.topic;
            zoomInfo.bookmark = false;
            ZoomInfoManager.getInstance().addZoomInfo(zoomInfo);
            // since it's a non-bookmark, refresh the meetings section
            commands.executeCommand("zoomtime.refreshMeetingTree");
        }
        return meetingInfo;
    }
}
