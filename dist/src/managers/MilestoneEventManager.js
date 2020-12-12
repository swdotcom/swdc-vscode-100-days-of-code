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
exports.MilestoneEventManager = void 0;
const vscode_1 = require("vscode");
const LogsUtil_1 = require("../utils/LogsUtil");
const MilestonesUtil_1 = require("../utils/MilestonesUtil");
const SummaryUtil_1 = require("../utils/SummaryUtil");
const Util_1 = require("../utils/Util");
const HttpManager_1 = require("./HttpManager");
class MilestoneEventManager {
    constructor() {
        this._checkingForMilestones = false;
        // document listener handlers
        vscode_1.workspace.onDidOpenTextDocument(this._onOpenHandler, this);
        vscode_1.workspace.onDidCloseTextDocument(this._onCloseHandler, this);
        vscode_1.workspace.onDidChangeTextDocument(this._onEventHandler, this);
        // window state changed handler
        vscode_1.window.onDidChangeWindowState(this._windowStateChanged, this);
        this.checkMilestonesLazily();
    }
    static getInstance() {
        if (!MilestoneEventManager.instance) {
            MilestoneEventManager.instance = new MilestoneEventManager();
        }
        return MilestoneEventManager.instance;
    }
    _onCloseHandler(textDoc) {
        // set a timer to check so we don't disrupt typing
        this.checkMilestonesLazily();
    }
    _onOpenHandler(textDoc) {
        // set a timer to check so we don't disrupt typing
        this.checkMilestonesLazily();
    }
    _onEventHandler(textDocChangeEvent) {
        // set a timer to check so we don't disrupt typing
        this.checkMilestonesLazily();
    }
    _windowStateChanged(winState) {
        this.checkMilestonesLazily();
    }
    checkMilestonesLazily() {
        if (this._checkMilestoneTimeout) {
            // cancel the current one
            clearTimeout(this._checkMilestoneTimeout);
            this._checkMilestoneTimeout = null;
        }
        this._checkMilestoneTimeout = setTimeout(() => {
            this.checkForMilestones();
        }, 1000 * 30);
    }
    checkForMilestones() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!Util_1.isLoggedIn() || this._checkingForMilestones) {
                return;
            }
            this._checkingForMilestones = true;
            // updates logs with latest metrics and checks for milestones
            // checks to see if there are any new achieved milestones
            const achievedTimeMilestones = MilestonesUtil_1.checkCodeTimeMetricsMilestonesAchieved();
            // checks to see if there are any new language milestones achieved
            const achievedLangMilestones = MilestonesUtil_1.checkLanguageMilestonesAchieved();
            // checks to see if there are any day milestones achived
            const achievedDaysMilestones = MilestonesUtil_1.checkDaysMilestones();
            if (achievedDaysMilestones.length || achievedLangMilestones.length || achievedTimeMilestones.length) {
                // get the current milestones so if its an update, the milestone array
                // has all milestones for this day instead of getting replaced by a new set of milestones
                const currentMilestones = MilestonesUtil_1.getTodaysLocalMilestones() || [];
                // update the server
                yield this.upsertMilestones(currentMilestones);
                // fetch the milestones
                yield this.fetchMilestones();
                // syncs the Summary info (hours, lines, etc) to the file
                SummaryUtil_1.syncSummary();
            }
            this._checkingForMilestones = false;
        });
    }
    upsertMilestones(milestones) {
        return __awaiter(this, void 0, void 0, function* () {
            const dateNow = new Date();
            const millisNow = dateNow.valueOf();
            // handles creating and updating of milestones and adds milestones accordingly
            const d = new Date(millisNow);
            const offset_minutes = d.getTimezoneOffset();
            const day_number = LogsUtil_1.getDayNumberFromDate(millisNow);
            const milestoneData = [{
                    day_number,
                    unix_date: Math.round(millisNow / 1000),
                    local_date: Math.round(millisNow / 1000) - offset_minutes * 60,
                    offset_minutes,
                    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                    milestones
                }];
            yield HttpManager_1.softwarePost("/100doc/milestones", milestoneData, Util_1.getItem("jwt"));
        });
    }
    /**
 * This will return an array of..
 * [{challenge_round, createdAt, day_number, local_date, milestones [numbers], offset_minutes, timezone, type, unix_date, userId}]
 * @param date
 */
    fetchMilestones(date = null) {
        return __awaiter(this, void 0, void 0, function* () {
            const jwt = Util_1.getItem("jwt");
            const ONE_DAY_SEC = 68400000;
            // default to today and yesterday
            let endDate = new Date(); // 11:59:59 pm today
            let startDate = new Date(endDate.valueOf() - ONE_DAY_SEC * 2); // 12:00:01 am yesterday
            if (date) {
                endDate = new Date(date); // 11:59:59 pm today
                startDate = new Date(endDate.valueOf() - ONE_DAY_SEC); // 12:00:01 am yesterday
            }
            // normalize dates
            startDate.setHours(0, 0, 1, 0);
            endDate.setHours(23, 59, 59, 0);
            // query params
            const start_date = Math.round(startDate.valueOf() / 1000);
            const end_date = Math.round(endDate.valueOf() / 1000);
            const milestoneData = yield HttpManager_1.softwareGet(`/100doc/milestones?start_date=${start_date}&end_date=${end_date}`, jwt).then(resp => {
                if (HttpManager_1.isResponseOk(resp) && resp.data) {
                    return resp.data;
                }
                return null;
            });
            // sync with local
            if (milestoneData) {
                MilestonesUtil_1.compareWithLocalMilestones(milestoneData);
            }
            // return milestones
            return milestoneData;
        });
    }
    /**
    * This will return an array of..
    * [{challenge_round, createdAt, day_number, local_date, milestones [numbers], offset_minutes, timezone, type, unix_date, userId}]
    * @param date a date value (timestamp or date string)
    */
    fetchAllMilestones() {
        return __awaiter(this, void 0, void 0, function* () {
            const jwt = Util_1.getItem("jwt");
            const milestoneData = yield HttpManager_1.softwareGet("/100doc/milestones", jwt).then(resp => {
                if (HttpManager_1.isResponseOk(resp) && resp.data) {
                    return resp.data;
                }
                return null;
            });
            // sync with local
            if (milestoneData) {
                MilestonesUtil_1.compareWithLocalMilestones(milestoneData);
            }
            // return milestones
            return milestoneData;
        });
    }
}
exports.MilestoneEventManager = MilestoneEventManager;
//# sourceMappingURL=MilestoneEventManager.js.map