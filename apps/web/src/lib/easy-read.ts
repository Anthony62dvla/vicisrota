import { londonParts } from "@vicisrota/compliance";
import { spokenLength as lengthIn, spokenTime as timeIn, type Lang } from "@vicisrota/messaging";

/** A time said the way people say it: "9 in the morning", "half past 1 in the afternoon", "midnight". */
export const spokenTime = (d: Date, lang: Lang = "en") => {
  const { hour, minute } = londonParts(d.getTime());
  return timeIn(lang, hour, minute);
};

/** Which picture suits the start of a shift. */
export const timeOfDay = (d: Date): "morning" | "day" | "evening" | "night" => {
  const { hour } = londonParts(d.getTime());
  return hour >= 5 && hour < 11 ? "morning" : hour >= 11 && hour < 17 ? "day" : hour >= 17 && hour < 21 ? "evening" : "night";
};

/** "8 hours", "7 and a half hours", "45 minutes", in the person's language. */
export const spokenLength = (minutes: number, lang: Lang = "en") => lengthIn(lang, minutes);
