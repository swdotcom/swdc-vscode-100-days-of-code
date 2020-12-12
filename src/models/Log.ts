import { CodetimeMetrics } from "./CodetimeMetrics";
import { NO_TITLE_LABEL } from "../utils/Constants";

export class Log {
    public day_number: number = 0;
    public date: number = Date.now();;
    public title: string = NO_TITLE_LABEL;
    public description: string = "";
    public links: Array<string> = [];
    public codetime_metrics: CodetimeMetrics = new CodetimeMetrics();
    public shared: boolean = false;
    public milestones: Array<number> = [];
}
