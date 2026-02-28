export type ActivityType = "walking" | "cycling";

export const DEFAULT_ACTIVITY_TYPE: ActivityType = "walking";

export const ACTIVITY_LABELS: Record<ActivityType, string> = {
  walking: "Walking / Running",
  cycling: "Cycling",
};
