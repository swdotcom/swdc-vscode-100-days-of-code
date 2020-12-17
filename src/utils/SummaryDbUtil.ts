import { updateLocalSummary } from "./SummaryUtil";
import { softwareGet, isResponseOk } from "../managers/HttpManager";
import { getItem } from "./Util";

export async function fetchSummary() {
    const summary = await softwareGet("/100doc/summary", getItem("jwt")).then(resp => {
        if (isResponseOk(resp) && resp.data) {
            const summary = {
                ...resp.data,
                hours: resp.data.minutes / 60
            };
            return summary;
        }
    });
    if (summary) {
        updateLocalSummary(summary);
    }
}
