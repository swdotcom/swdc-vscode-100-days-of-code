import { getSoftwareDir, isWindows } from "./Util";
import fs = require("fs");
import { window } from "vscode";
import { getMostRecentLogObject, checkLogsJson } from "./LogsUtil";
export function getUserJson() {
  let file = getSoftwareDir();
  if (isWindows()) {
    file += "\\User.json";
  } else {
    file += "/User.json";
  }
  return file;
}
export function checkUserJson() {
  const filepath = getUserJson();
  try {
    if (fs.existsSync(filepath)) {
      return true;
    } else {
      fs.writeFileSync(
        filepath,
        [
          `{\n\t"name": "",`,
          `\t"email": "",`,
          `\t"days": 0,`,
          `\t"hours": 0,`,
          `\t"longest_streak": 0,`,
          `\t"milestones": 0,`,
          `\t"lines_added": 0,`,
          `\t"lines_deleted": 0,`,
          `\t"keystrokes": 0,`,
          `\t"recent_milestones": [],`,
          `\t"curr_streak": 0,`,
          `\t"shares": 0,`,
          `\t"languages": [],`,
          `\t"lastUpdated":  0'\n}`,
        ].join("\n")
      );
      return true;
    }
  } catch (err) {
    return false;
  }
}
export function updateUserJson() {
  const userExists = checkUserJson();
  const logsExists = checkLogsJson();
  if (!userExists || !logsExists) {
    return;
  }
  let user = getUserObject();
  let log = getMostRecentLogObject();
  let lastUpdatedDate = new Date(user.lastUpdated);
  var lastUpdatedDayOfMonth = lastUpdatedDate.getDate();
  var lastUpdatedMonth = lastUpdatedDate.getMonth();
  var lastUpdatedYear = lastUpdatedDate.getFullYear();
  let todaysDate = new Date();
  var todaysDayOfMonth = todaysDate.getDate();
  var todaysMonth = todaysDate.getMonth();
  var todaysYear = todaysDate.getFullYear();
  if (
    todaysDayOfMonth !== lastUpdatedDayOfMonth ||
    todaysMonth !== lastUpdatedMonth ||
    todaysYear !== lastUpdatedYear
  ) {
    user.hours += log.codetime_metrics.hours;
    user.keystrokes += log.codetime_metrics.keystrokes;
    user.lines_added += log.codetime_metrics.lines_added;
    user.lines_deleted += log.codetime_metrics.lines_deleted;
    user.recent_milestones = log.milestones
      .reverse()
      .concat(user.recent_milestones);
    while (user.recent_milestones.length > 7) {
      user.recent_milestones.pop();
    }
    user.lastUpdated = new Date().getTime();
    const filepath = getUserJson();
    try {
      fs.writeFileSync(filepath, JSON.stringify(user, null, 4));
    } catch (err) {
      console.log(err);
      return;
    }
  }
}
export function getUserObject() {
  const exists = checkUserJson();
  if (!exists) {
    window.showErrorMessage("Cannot access User file!");
  }
  const filepath = getUserJson();
  let rawUser = fs.readFileSync(filepath).toString();
  let User = JSON.parse(rawUser);
  return User;
}
export function getDaysLevel(daysComplete: number): number {
  if (daysComplete >= 110) {
    return 6;
  } else if (daysComplete >= 100) {
    return 5;
  } else if (daysComplete >= 75) {
    return 4;
  } else if (daysComplete >= 50) {
    return 3;
  } else if (daysComplete >= 10) {
    return 2;
  } else if (daysComplete >= 1) {
    return 1;
  } else {
    return 0;
  }
}
export function getHoursLevel(hoursCoded: number): number {
  if (hoursCoded >= 200) {
    return 6;
  } else if (hoursCoded >= 120) {
    return 5;
  } else if (hoursCoded >= 90) {
    return 4;
  } else if (hoursCoded >= 60) {
    return 3;
  } else if (hoursCoded >= 30) {
    return 2;
  } else if (hoursCoded >= 1) {
    return 1;
  } else {
    return 0;
  }
}
export function getLongStreakLevel(longestStreak: number): number {
  if (longestStreak >= 100) {
    return 6;
  } else if (longestStreak >= 60) {
    return 5;
  } else if (longestStreak >= 30) {
    return 4;
  } else if (longestStreak >= 14) {
    return 3;
  } else if (longestStreak >= 7) {
    return 2;
  } else if (longestStreak >= 2) {
    return 1;
  } else {
    return 0;
  }
}
export function getMilestonesEarnedLevel(milestones: number): number {
  if (milestones >= 50) {
    return 6;
  } else if (milestones >= 40) {
    return 5;
  } else if (milestones >= 30) {
    return 4;
  } else if (milestones >= 20) {
    return 3;
  } else if (milestones >= 10) {
    return 2;
  } else if (milestones >= 1) {
    return 1;
  } else {
    return 0;
  }
}
export function getAverageHoursLevel(avgHour: number): number {
  if (avgHour >= 3.0) {
    return 6;
  } else if (avgHour >= 2.5) {
    return 5;
  } else if (avgHour >= 2.0) {
    return 4;
  } else if (avgHour >= 1.5) {
    return 3;
  } else if (avgHour >= 1.0) {
    return 2;
  } else if (avgHour >= 0.5) {
    return 1;
  } else {
    return 0;
  }
}
