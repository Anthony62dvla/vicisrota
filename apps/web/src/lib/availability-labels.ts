/** Safe to import in the browser. 1 = Monday to 7 = Sunday. */
export const WEEKDAYS = [
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
  { value: 7, label: "Sunday" },
] as const;

export const weekdayName = (n: number) => WEEKDAYS.find((d) => d.value === n)?.label ?? "";

/** "09:00 to 17:00", or "all day" for a whole day. */
export const slotText = (from: string, to: string) => (from === "00:00" && to === "24:00" ? "all day" : `${from} to ${to === "24:00" ? "midnight" : to}`);

export type Adjustments = { maxShiftHours?: number; earliestStart?: string; latestFinish?: string; note?: string };

/** Each agreed adjustment as a short line, for the person's own page and their staff record. */
export const adjustmentLines = (a: Adjustments) =>
  [
    a.maxShiftHours ? `Shifts no longer than ${a.maxShiftHours} hours` : null,
    a.earliestStart ? `Start no earlier than ${a.earliestStart}` : null,
    a.latestFinish ? `Finish by ${a.latestFinish}` : null,
  ].filter((l): l is string => !!l);
