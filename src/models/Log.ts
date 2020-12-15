import { CodetimeMetrics } from "./CodetimeMetrics";
import { NO_TITLE_LABEL } from "../utils/Constants";

const moment = require("moment-timezone");

export class Log {
    public day_number: number = 0;
    public unix_date: number = 0;
    public local_date: number = 0;
    public date: number = moment().valueOf();
    public title: string = NO_TITLE_LABEL;
    public description: string = "";
    public links: Array<string> = [];
    public codetime_metrics: CodetimeMetrics = new CodetimeMetrics();
    public shared: boolean = false;
    public milestones: Array<number> = [];
}
