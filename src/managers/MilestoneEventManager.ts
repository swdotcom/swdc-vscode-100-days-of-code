import { window, WindowState } from "vscode";
import { getDayNumberFromDate } from "../utils/LogsUtil";
import {
  checkCodeTimeMetricsMilestonesAchieved,
  checkDaysMilestones,
  checkLanguageMilestonesAchieved,
  compareWithLocalMilestones,
  getTodaysLocalMilestones,
} from "../utils/MilestonesUtil";
import { getCurrentChallengeRound, syncSummary } from "../utils/SummaryUtil";
import { getItem, isLoggedIn, setItem } from "../utils/Util";
import { isResponseOk, softwareGet, softwarePost } from "./HttpManager";

const queryString = require("query-string");

let milestoneTimer: NodeJS.Timer = undefined;
const MILESTONE_CHECK_THESHOLD = 1000 * 60 * 3;

export class MilestoneEventManager {
  private static instance: MilestoneEventManager;

  private _checkingForMilestones: boolean = false;

  static getInstance(): MilestoneEventManager {
    if (!MilestoneEventManager.instance) {
      MilestoneEventManager.instance = new MilestoneEventManager();
    }

    return MilestoneEventManager.instance;
  }

  private constructor() {
    if (!milestoneTimer) {
      milestoneTimer = setInterval(() => {
        this.checkForMilestones();
      }, 1000 * 60 * 3);

      window.onDidChangeWindowState(this._windowStateChanged, this);
    }
  }

  private _windowStateChanged(winState: WindowState) {
    if (winState.focused) {
      const now = new Date().getTime();
      const lastTimeChecked = getItem("last100doc_milestoneCheckTime") ?? 0;
      const passedThreshold = !!(now - lastTimeChecked >= MILESTONE_CHECK_THESHOLD);
      if (passedThreshold) {
        this.checkForMilestones();
      }
    }
  }

  public dispose() {
    if (milestoneTimer) {
      clearInterval(milestoneTimer);
      milestoneTimer = null;
    }
  }

  private async checkForMilestones() {
    if (!isLoggedIn() || this._checkingForMilestones || !window.state.focused) {
      return;
    }
    const now = new Date().getTime();
    setItem("last100doc_milestoneCheckTime", now);
    this._checkingForMilestones = true;
    // updates logs with latest metrics and checks for milestones

    // checks to see if there are any new achieved milestones
    const achievedTimeMilestones = checkCodeTimeMetricsMilestonesAchieved();

    // checks to see if there are any new language milestones achieved
    const achievedLangMilestones = checkLanguageMilestonesAchieved();

    // checks to see if there are any day milestones achived
    const achievedDaysMilestones = checkDaysMilestones();

    if (achievedDaysMilestones.length || achievedLangMilestones.length || achievedTimeMilestones.length) {
      // get the current milestones so if its an update, the milestone array
      // has all milestones for this day instead of getting replaced by a new set of milestones
      const currentMilestones: Array<number> = getTodaysLocalMilestones() || [];

      // update the server
      await this.upsertMilestones(currentMilestones);

      // fetch the milestones
      await this.fetchMilestones();

      // syncs the Summary info (hours, lines, etc) to the file
      syncSummary();
    }
    this._checkingForMilestones = false;
  }

  private async upsertMilestones(milestones: Array<number>) {
    const dateNow = new Date();
    const millisNow = dateNow.valueOf();
    // handles creating and updating of milestones and adds milestones accordingly
    const d = new Date(millisNow);
    const offset_minutes = d.getTimezoneOffset();
    const day_number = getDayNumberFromDate(millisNow);
    const milestoneData = [
      {
        day_number,
        unix_date: Math.round(millisNow / 1000), // milliseconds --> seconds
        local_date: Math.round(millisNow / 1000) - offset_minutes * 60, // milliseconds --> seconds,
        offset_minutes,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        milestones,
        challenge_round: getCurrentChallengeRound(),
      },
    ];

    await softwarePost("/100doc/milestones", milestoneData, getItem("jwt"));
  }

  /**
   * This will return an array of..
   * [{challenge_round, createdAt, day_number, local_date, milestones [numbers], offset_minutes, timezone, type, unix_date, userId}]
   * @param date
   */
  public async fetchMilestones(date: any = null): Promise<any> {
    const jwt = getItem("jwt");
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
    const qryStr = queryString.stringify({
      start_date: Math.round(startDate.valueOf() / 1000),
      end_date: Math.round(endDate.valueOf() / 1000),
      challenge_round: getCurrentChallengeRound(),
    });

    const milestoneData = await softwareGet(`/100doc/milestones?${qryStr}`, jwt).then((resp) => {
      if (isResponseOk(resp) && resp.data) {
        return resp.data;
      }
      return null;
    });

    // sync with local
    if (milestoneData) {
      compareWithLocalMilestones(milestoneData);
    }

    // return milestones
    return milestoneData;
  }

  /**
   * This will return an array of..
   * [{challenge_round, createdAt, day_number, local_date, milestones [numbers], offset_minutes, timezone, type, unix_date, userId}]
   * @param date a date value (timestamp or date string)
   */
  public async fetchAllMilestones(): Promise<any> {
    const jwt = getItem("jwt");

    const qryStr = queryString.stringify({
      challenge_round: getCurrentChallengeRound(),
    });

    const milestoneData = await softwareGet(`/100doc/milestones?${qryStr}`, jwt).then((resp) => {
      if (isResponseOk(resp) && resp.data) {
        return resp.data;
      }
      return null;
    });

    // sync with local
    if (milestoneData) {
      compareWithLocalMilestones(milestoneData);
    }

    // return milestones
    return milestoneData;
  }
}
