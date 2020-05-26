import { TreeNode } from "../models/TreeNode";

export function getActionButton(
    label: string,
    tooltip: string,
    command: string,
    icon: any = null,
    eventDescription: string = ""
): TreeNode {
    const item: TreeNode = new TreeNode();
    item.tooltip = tooltip;
    item.label = label;
    item.id = label;
    item.command = command;
    item.icon = icon;
    item.contextValue = "action_button";
    item.eventDescription = eventDescription;
    return item;
}

// export function getSubmitFeedbackButton() {
//     return getActionButton(
//         "Submit feedback",
//         "Send us an email at cody@software.com",
//         "zoomtime.sendFeedback",
//         "message.svg"
//     );
// }

export function getLearnMoreButton() {
    return getActionButton(
        "Learn more",
        "View the Code Time Readme to learn more",
        "DoC.ViewReadme",
        "learn-more.svg"
    );
}

export function getDoCToggleStatusBar() {
    return getActionButton(
        "Hide status bar metrics",
        "Hide status bar metrics",
        "DoC.ToggleStatusbar",
        "visible.svg"
    );
}

// export function getLaunchSoftwareWebButton() {
//     return getActionButton(
//         "Launch Software.com",
//         "Opens software.com in browser",
//         "DoC.LaunchSoftwareWebsite",
//         "sw-paw-circle.svg"
//     );
// }

export function getBlankBlueLine() {
    return getActionButton(
        " ",
        " ",
        "",
        "blue-line-96.png"
    );
}

export function getDocGoalsButton() {
    return getActionButton(
        "Goals",
        "View your goals",
        "DoC.goalsCMD",
        "view-edit-goals.svg"
    );
}

export function getDocDiaryAddButton() {
    return getActionButton(
        "Add page to Diary",
        "Add a page to your Diary",
        "DoC.diaryAdd",
        "add-diary.svg"
    );
}

export function getDocDiaryButton() {
    return getActionButton(
        "Diary",
        "View your diary entries",
        "DoC.diaryCMD",
        "view-diary.svg"
    );
}

export function getDocMilestonesButton() {
    return getActionButton(
        "Milestones",
        "View your milestones",
        "DoC.milestonesCMD",
        "view-milestone.svg"
    );
}




