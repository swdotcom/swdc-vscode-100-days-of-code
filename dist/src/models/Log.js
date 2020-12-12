"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Log = void 0;
const CodetimeMetrics_1 = require("./CodetimeMetrics");
class Log {
    constructor() {
        this.day_number = 0;
        this.date = 0;
        this.title = "";
        this.description = "";
        this.links = [];
        this.codetime_metrics = new CodetimeMetrics_1.CodetimeMetrics();
        this.shared = false;
        this.milestones = [];
    }
}
exports.Log = Log;
//# sourceMappingURL=Log.js.map