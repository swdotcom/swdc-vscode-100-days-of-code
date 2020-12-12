"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getOffsetSeconds = exports.getOs = exports.getVersion = exports.getPluginName = exports.getPluginId = void 0;
const vscode_1 = require("vscode");
const Constants_1 = require("./Constants");
const os = require("os");
function getPluginId() {
    return Constants_1._100_DAYS_OF_CODE_PLUGIN_ID;
}
exports.getPluginId = getPluginId;
function getPluginName() {
    return Constants_1._100_DAYS_OF_CODE_EXT_ID;
}
exports.getPluginName = getPluginName;
function getVersion() {
    const extension = vscode_1.extensions.getExtension(Constants_1._100_DAYS_OF_CODE_EXT_ID);
    if (extension) {
        return extension.packageJSON.version;
    }
    else {
        return;
    }
}
exports.getVersion = getVersion;
function getOs() {
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
exports.getOs = getOs;
function getOffsetSeconds() {
    let d = new Date();
    return d.getTimezoneOffset() * 60;
}
exports.getOffsetSeconds = getOffsetSeconds;
//# sourceMappingURL=PluginUtil.js.map