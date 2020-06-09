import { CodetimeMetrics } from "./CodetimeMetrics";

export class Log {
    public day_number?: number = undefined;
    public date: number = 0;
    public title: string = "";
    public description: string = "";
    public links: Array<string> = [];
    public codetime_metrics: CodetimeMetrics = new CodetimeMetrics();
    public shared: boolean = false;
    public milestones: Array<number> = [];
}
