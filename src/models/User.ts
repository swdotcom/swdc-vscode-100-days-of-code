export class User {
    public name: string = "";
    public email: string = "";
    public days: number = 0;
    public hours: number = 0;
    public longest_streak: number = 0;
    public milestones: number = 0;
    public lines_added: number = 0;
    public lines_deleted: number = 0;
    public keystrokes: number = 0;
    public recent_milestones: number[] = [];
    public curr_streak: number = 0;
    public shares: number = 0;
    public languages: string[] = [];
    public lastUpdated: number = 0;
}
