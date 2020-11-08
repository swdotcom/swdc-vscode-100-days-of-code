import { TextDocument, TextDocumentChangeEvent, window, WindowState, workspace } from "vscode";
import { getDayNumberFromDate } from "../utils/LogsUtil";
import { checkCodeTimeMetricsMilestonesAchieved, checkDaysMilestones, checkLanguageMilestonesAchieved, compareWithLocalMilestones, getMilestonesByDate } from "../utils/MilestonesUtil";
import { syncSummary } from "../utils/SummaryUtil";
import { getItem, isLoggedIn } from "../utils/Util";
import { isResponseOk, softwareGet, softwarePost } from "./HttpManager";

export class MilestoneEventManager {
	private static instance: MilestoneEventManager;

	private _checkMilestoneTimeout: any;
	private _checkingForMilestones: boolean = false;

	static getInstance(): MilestoneEventManager {
		if (!MilestoneEventManager.instance) {
			MilestoneEventManager.instance = new MilestoneEventManager();
		}

		return MilestoneEventManager.instance;
	}

	private constructor() {
		// document listener handlers
		workspace.onDidOpenTextDocument(this._onOpenHandler, this);
		workspace.onDidCloseTextDocument(this._onCloseHandler, this);
		workspace.onDidChangeTextDocument(this._onEventHandler, this);
		// window state changed handler
		window.onDidChangeWindowState(this._windowStateChanged, this);

		this.checkMilestonesLazily();
	}

	private _onCloseHandler(textDoc: TextDocument) {
		// set a timer to check so we don't disrupt typing
		this.checkMilestonesLazily();
	}

	private _onOpenHandler(textDoc: TextDocument) {
		// set a timer to check so we don't disrupt typing
		this.checkMilestonesLazily();
	}

	private _onEventHandler(textDocChangeEvent: TextDocumentChangeEvent) {
		// set a timer to check so we don't disrupt typing
		this.checkMilestonesLazily();
	}

	private _windowStateChanged(winState: WindowState) {
		this.checkMilestonesLazily();
	}

	private checkMilestonesLazily() {
		if (this._checkMilestoneTimeout) {
			// cancel the current one
			clearTimeout(this._checkMilestoneTimeout);
			this._checkMilestoneTimeout = null;
		}
		this._checkMilestoneTimeout = setTimeout(() => {
			this.checkForMilestones();
		}, 1000 * 30);
	}

	private async checkForMilestones() {
		if (!isLoggedIn() || this._checkingForMilestones) {
			return;
		}
		this._checkingForMilestones = true;
		// updates logs with latest metrics and checks for milestones

		// checks to see if there are any new achieved milestones
		const achievedTimeMilestones = checkCodeTimeMetricsMilestonesAchieved();

		// checks to see if there are any new language milestones achieved
		const achievedLangMilestones = checkLanguageMilestonesAchieved();

		// checks to see if there are any day milestones achived
		const achievedDaysMilestones = checkDaysMilestones();

		if (achievedDaysMilestones.length || achievedLangMilestones.length || achievedTimeMilestones.length) {
			// get the current milestones so if its an update the milestone array
			// has them all instead of getting replaced by net new milestones
			const currentMilestones: Array<number> = getMilestonesByDate(new Date().valueOf()) || [];

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
		const milestoneData = [{
			day_number,
			unix_date: Math.round(millisNow / 1000), // milliseconds --> seconds
			local_date: Math.round(millisNow / 1000) - offset_minutes * 60, // milliseconds --> seconds,
			offset_minutes,
			timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
			milestones
		}];

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
		const start_date = Math.round(startDate.valueOf() / 1000);
		const end_date = Math.round(endDate.valueOf() / 1000);

		const milestoneData = await softwareGet(`/100doc/milestones?start_date=${start_date}&end_date=${end_date}`, jwt).then(resp => {
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

		const milestoneData = await softwareGet("/100doc/milestones", jwt).then(resp => {
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