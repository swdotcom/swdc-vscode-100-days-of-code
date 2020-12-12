import fs = require("fs");
import { getItem } from "./Util";
import { softwareGet, isResponseOk, softwarePost, softwarePut, softwareDelete } from "../managers/HttpManager";
import { getFileDataAsJson, getFile } from "../managers/FileManager";
import { Log } from "../models/Log";
import { commands, window } from "vscode";
import { getAllMilestones } from "./MilestonesUtil";
import { addDailyLog, writeToLogsJson } from "./LogsUtil";

const moment = require("moment-timezone");


