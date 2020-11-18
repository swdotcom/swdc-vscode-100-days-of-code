import { compareLocalSummary } from "./SummaryUtil";
import { softwareGet, isResponseOk } from "../managers/HttpManager";
import { getItem } from "./Util";

export async function fetchSummary() {
    const jwt = getItem("jwt");
    if (jwt) {
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
        }
    }
}
