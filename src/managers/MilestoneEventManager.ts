import { window, WindowState } from "vscode";
import {
  checkCodeTimeMetricsMilestonesAchieved,
  checkDaysMilestones,
  checkLanguageMilestonesAchieved,
  compareWithLocalMilestones,
  getTodaysLocalMilestones,
} from "../utils/MilestonesUtil";
import { syncSummary } from "../utils/SummaryUtil";
import { getItem, isLoggedIn, setItem } from "../utils/Util";

let milestoneTimer: NodeJS.Timer = undefined;
const MILESTONE_CHECK_THESHOLD = 1000 * 60 * 10;

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

      // fetch the milestones
      await this.fetchMilestones();

      // syncs the Summary info (hours, lines, etc) to the file
      syncSummary();
    }
    this._checkingForMilestones = false;
  }

  /**
   * This will return an array of..
   * [{challenge_round, createdAt, day_number, local_date, milestones [numbers], offset_minutes, timezone, type, unix_date, userId}]
   * @param date
   */
  public async fetchMilestones(date: any = null): Promise<any> {
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

    const milestoneData = [];

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

    const milestoneData = [];

    // sync with local
    if (milestoneData) {
      compareWithLocalMilestones(milestoneData);
    }

    // return milestones
    return milestoneData;
  }
}
