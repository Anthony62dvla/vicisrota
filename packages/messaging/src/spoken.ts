import type { Lang } from "./languages";

/** The few-forms plural rule Polish uses: 1, then 2 to 4 (but not 12 to 14), then the rest. */
const plPlural = (n: number, one: string, few: string, many: string) =>
  n === 1 ? one : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? few : many;
/** Romanian adds "de" before the noun from 20 upwards (20 de minute) except where the last two digits are 1 to 19. */
const roDe = (n: number) => (n % 100 >= 20 || (n >= 100 && n % 100 === 0) ? "de " : "");

/**
 * A time said the way people say it. English uses the 12-hour clock with words ("half past 1 in the
 * afternoon"); Welsh, Polish and Romanian speakers commonly say the 24-hour time, which also avoids grammar
 * that changes around the number.
 */
export const spokenTime = (lang: Lang, hour: number, minute: number) => {
  if (lang !== "en") return `${hour}:${String(minute).padStart(2, "0")}`;
  if (minute === 0 && hour === 0) return "midnight";
  if (minute === 0 && hour === 12) return "midday";
  const h = hour % 12 === 0 ? 12 : hour % 12;
  const part = hour < 12 ? "in the morning" : hour < 17 ? "in the afternoon" : hour < 21 ? "in the evening" : "at night";
  const clock =
    minute === 0 ? `${h}` : minute === 15 ? `quarter past ${h}` : minute === 30 ? `half past ${h}` : minute === 45 ? `quarter to ${h === 12 ? 1 : h + 1}` : `${h}:${String(minute).padStart(2, "0")}`;
  return `${clock} ${part}`;
};

/** A length of time: "8 hours", "7 and a half hours", "45 minutes", in the person's language. */
export const spokenLength = (lang: Lang, minutes: number) => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const half = h > 0 && m === 30;
  switch (lang) {
    case "cy": {
      // Welsh keeps the noun singular after a number: 8 awr, 45 munud.
      if (h === 0) return `${m} munud`;
      return `${h} awr${half ? " a hanner" : m ? ` a ${m} munud` : ""}`;
    }
    case "pl": {
      const mins = (n: number) => `${n} ${plPlural(n, "minuta", "minuty", "minut")}`;
      if (h === 0) return mins(m);
      if (half) return h === 1 ? "półtorej godziny" : `${h} i pół godziny`;
      return `${h} ${plPlural(h, "godzina", "godziny", "godzin")}${m ? ` i ${mins(m)}` : ""}`;
    }
    case "ro": {
      const mins = (n: number) => (n === 1 ? "un minut" : `${n} ${roDe(n)}minute`);
      if (h === 0) return mins(m);
      const hours = h === 1 ? "o oră" : `${h} ${roDe(h)}ore`;
      return `${hours}${half ? " și jumătate" : m ? ` și ${mins(m)}` : ""}`;
    }
    default: {
      if (h === 0) return `${m} minutes`;
      const rest = m && !half ? ` and ${m} minutes` : "";
      return `${h}${half ? " and a half" : ""} ${h === 1 && !half ? "hour" : "hours"}${rest}`;
    }
  }
};
