export class ZoomMeeting {
    public join_url: string = "";
    public created_at: string = "";
    public timezone: string = "";
    public duration: number = 0;
    public start_time: string = "";
    // 1 = instant, 2 = scheduled, 3 = recurring w/ no fixed time, 8 = recurring w/ fixed time
    public type: number = 0;
    public topic: string = "";
    public host_id: string = "";
    public id: string = "";
    public uuid: string = "";
    public bookmark: boolean = false;
    public description: string = "";
    public start_time_seconds: number = 0;
}
