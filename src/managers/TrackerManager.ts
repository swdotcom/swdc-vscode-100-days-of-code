import swdcTracker from "swdc-tracker";
import { api_endpoint } from "../utils/Constants";
import { getJwt } from "../utils/Util";
import { getPluginId, getPluginName, getVersion } from "../utils/Util";

export class TrackerManager {
	private static instance: TrackerManager;

	private trackerReady: boolean = false;

	private constructor() { }

	static getInstance(): TrackerManager {
		if (!TrackerManager.instance) {
			TrackerManager.instance = new TrackerManager();
		}

		return TrackerManager.instance;
	}

	public async init() {
		const result = await swdcTracker.initialize(
			api_endpoint,
			"100 Days of Code",
			"softwaredotcom.swdc-vscode"
		)

		if (result.status === 200) {
			this.trackerReady = true;
		}
	}

	public async trackUIInteraction(
		interaction_type: string,
		element_name: string,
		element_location: string,
		color: string = "",
		icon_name: string = "",
		cta_text: string = ""
	) {
		if (!this.trackerReady) {
			return;
		}

		const payload = {
			jwt: getJwt(),
			interaction_type: interaction_type,
			element_name: element_name,
			element_location: element_location,
			color: color,
			icon_name: icon_name,
			cta_text: cta_text,
			plugin_id: getPluginId(),
			plugin_name: getPluginName(),
			plugin_version: getVersion()
		}

		swdcTracker.trackUIInteraction(payload)
	}
}