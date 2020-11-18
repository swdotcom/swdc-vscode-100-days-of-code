import { extensions } from "vscode";
import { _100_DAYS_OF_CODE_EXT_ID, _100_DAYS_OF_CODE_PLUGIN_ID } from "./Constants";
const os = require("os");

export function getPluginId() {
	return _100_DAYS_OF_CODE_PLUGIN_ID;
}

export function getPluginName() {
	return _100_DAYS_OF_CODE_EXT_ID;
}

export function getVersion() {
	const extension = extensions.getExtension(_100_DAYS_OF_CODE_EXT_ID);
	if (extension) {
			return extension.packageJSON.version;
	} else {
			return;
	}
}

export function getOs() {
	let parts = [];
	let osType = os.type();
	if (osType) {
			parts.push(osType);
	}
	let osRelease = os.release();
	if (osRelease) {
			parts.push(osRelease);
	}
	let platform = os.platform();
	if (platform) {
			parts.push(platform);
	}
	if (parts.length > 0) {
			return parts.join("_");
	}
	return "";
}

export function getOffsetSeconds() {
	let d = new Date();
	return d.getTimezoneOffset() * 60;
}