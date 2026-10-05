import { londonParts } from "@vicisrota/compliance";

/** A time said the way people say it: "9 in the morning", "half past 1 in the afternoon", "midnight". */
export const spokenTime = (d: Date) => {
  const { hour, minute } = londonParts(d.getTime());
  if (minute === 0 && hour === 0) return "midnight";
  if (minute === 0 && hour === 12) return "midday";
  const h = hour % 12 === 0 ? 12 : hour % 12;
  const part = hour < 12 ? "in the morning" : hour < 17 ? "in the afternoon" : hour < 21 ? "in the evening" : "at night";
  const clock =
    minute === 0 ? `${h}` : minute === 15 ? `quarter past ${h}` : minute === 30 ? `half past ${h}` : minute === 45 ? `quarter to ${h === 12 ? 1 : h + 1}` : `${h}:${String(minute).padStart(2, "0")}`;
  return `${clock} ${part}`;
};

/** Which picture suits the start of a shift. */
export const timeOfDay = (d: Date): "morning" | "day" | "evening" | "night" => {
  const { hour } = londonParts(d.getTime());
  return hour >= 5 && hour < 11 ? "morning" : hour >= 11 && hour < 17 ? "day" : hour >= 17 && hour < 21 ? "evening" : "night";
};

/** "8 hours", "7 and a half hours", "45 minutes". */
export const spokenLength = (minutes: number) => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} minutes`;
  const half = m === 30 ? " and a half" : "";
  const rest = m && m !== 30 ? ` and ${m} minutes` : "";
  return `${h}${half} ${h === 1 && !half ? "hour" : "hours"}${rest}`;
};
