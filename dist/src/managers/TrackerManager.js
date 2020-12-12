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
exports.TrackerManager = void 0;
const swdc_tracker_1 = require("swdc-tracker");
const Constants_1 = require("../utils/Constants");
const Util_1 = require("../utils/Util");
const PluginUtil_1 = require("../utils/PluginUtil");
class TrackerManager {
    constructor() {
        this.trackerReady = false;
    }
    static getInstance() {
        if (!TrackerManager.instance) {
            TrackerManager.instance = new TrackerManager();
        }
        return TrackerManager.instance;
    }
    init() {
        return __awaiter(this, void 0, void 0, function* () {
            const result = yield swdc_tracker_1.default.initialize(Constants_1.api_endpoint, "100 Days of Code", "softwaredotcom.swdc-vscode");
            if (result.status === 200) {
                this.trackerReady = true;
            }
        });
    }
    trackUIInteraction(interaction_type, element_name, element_location, color = "", icon_name = "", cta_text = "") {
        return __awaiter(this, void 0, void 0, function* () {
            // only send events if the user is logged in via code time
            if (!this.trackerReady || !Util_1.isLoggedIn()) {
                return;
            }
            const payload = {
                jwt: Util_1.getJwt(),
                interaction_type: interaction_type,
                element_name: element_name,
                element_location: element_location,
                color: color,
                icon_name: icon_name,
                cta_text: cta_text,
                plugin_id: PluginUtil_1.getPluginId(),
                plugin_name: PluginUtil_1.getPluginName(),
                plugin_version: PluginUtil_1.getVersion()
            };
            swdc_tracker_1.default.trackUIInteraction(payload);
        });
    }
}
exports.TrackerManager = TrackerManager;
//# sourceMappingURL=TrackerManager.js.map