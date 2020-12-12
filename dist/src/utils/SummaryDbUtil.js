"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchSummary = void 0;
const SummaryUtil_1 = require("./SummaryUtil");
const HttpManager_1 = require("../managers/HttpManager");
const Util_1 = require("./Util");
function fetchSummary() {
    return __awaiter(this, void 0, void 0, function* () {
        const jwt = Util_1.getItem("jwt");
        if (jwt) {
            const summary = yield HttpManager_1.softwareGet("/100doc/summary", jwt).then(resp => {
                if (HttpManager_1.isResponseOk(resp) && resp.data) {
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
                SummaryUtil_1.compareLocalSummary(summary);
            }
        }
    });
}
exports.fetchSummary = fetchSummary;
//# sourceMappingURL=SummaryDbUtil.js.map