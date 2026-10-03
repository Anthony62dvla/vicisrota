import type { Instant, LocalDate, Shift, Worker } from "./types";

export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

export const ms = (instant: Instant): number => {
  const t = Date.parse(instant);
  if (Number.isNaN(t)) throw new Error(`Invalid instant: ${instant}`);
  return t;
};

export const hours = (millis: number): number => millis / HOUR;

/** Paid working time of a shift: its length minus any recorded breaks. */
export const workedMillis = (shift: Shift): number => {
  const gross = ms(shift.end) - ms(shift.start);
  const breaks = (shift.breaks ?? []).reduce((sum, b) => sum + (ms(b.end) - ms(b.start)), 0);
  return gross - breaks;
};

/** Longest single break in a shift. Statutory breaks must be uninterrupted. */
export const longestBreakMillis = (shift: Shift): number =>
  Math.max(0, ...(shift.breaks ?? []).map((b) => ms(b.end) - ms(b.start)));

const londonFormat = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/London",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** Wall-clock parts in UK time, so night rules follow BST and GMT correctly. */
export const londonParts = (t: number) => {
  const parts = Object.fromEntries(londonFormat.formatToParts(t).map((p) => [p.type, p.value]));
  return {
    date: `${parts.year}-${parts.month}-${parts.day}` as LocalDate,
    hour: Number(parts.hour),
    minute: Number(parts.minute),
  };
};

/** Age in whole years on a given calendar date. */
export const ageOn = (dateOfBirth: LocalDate, on: LocalDate): number => {
  const [by, bm, bd] = dateOfBirth.split("-").map(Number) as [number, number, number];
  const [y, m, d] = on.split("-").map(Number) as [number, number, number];
  return y - by - (m < bm || (m === bm && d < bd) ? 1 : 0);
};

/** Under 18 and over compulsory school age: a "young worker" under the WTR. */
export const isYoungWorker = (worker: Worker, on: LocalDate): boolean => ageOn(worker.dateOfBirth, on) < 18;

export const shiftsByWorker = (shifts: Shift[]): Map<string, Shift[]> => {
  const map = new Map<string, Shift[]>();
  for (const s of shifts) {
    const list = map.get(s.workerId) ?? [];
    list.push(s);
    map.set(s.workerId, list);
  }
  for (const list of map.values()) list.sort((a, b) => ms(a.start) - ms(b.start));
  return map;
};

export const fmtHours = (millis: number): string => {
  const h = hours(millis);
  return Number.isInteger(h) ? `${h}h` : `${h.toFixed(1)}h`;
};

export const fmtMinutes = (millis: number): string => `${Math.round(millis / MINUTE)} minutes`;

/** The instant a UK wall-clock hour begins on a date, handling BST and GMT. */
export const londonInstant = (date: LocalDate, hour: number): number => {
  const naive = Date.parse(`${date}T00:00:00Z`) + hour * HOUR;
  // UK time is UTC or UTC+1; try BST first, then GMT.
  for (const offset of [HOUR, 0]) {
    const candidate = naive - offset;
    const p = londonParts(candidate);
    if (p.date === date && p.hour === hour % 24) return candidate;
  }
  return naive;
};

export const addDays = (date: LocalDate, days: number): LocalDate =>
  new Date(Date.parse(`${date}T12:00:00Z`) + days * DAY).toISOString().slice(0, 10);

/** The Monday that starts the UK week containing a date. */
export const weekStart = (date: LocalDate): LocalDate => {
  const dow = new Date(`${date}T12:00:00Z`).getUTCDay(); // 0 = Sunday
  return addDays(date, -((dow + 6) % 7));
};

/** Milliseconds of overlap between [aStart, aEnd) and [bStart, bEnd). */
export const overlap = (aStart: number, aEnd: number, bStart: number, bEnd: number): number =>
  Math.max(0, Math.min(aEnd, bEnd) - Math.max(aStart, bStart));
