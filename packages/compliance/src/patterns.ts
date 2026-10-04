/**
 * Repeating rota patterns. A pattern is one to four weeks of shifts kept as UK wall-clock times
 * ("Monday of week 2, 22:00 to 08:00 the next day"), so filling the rota from it gives the same
 * times on the clock either side of the clocks changing. Rotating rotas, such as a two-week
 * pattern in a care home, repeat in order: week 1, week 2, week 1, week 2.
 */
import { addDays, londonDateTime, londonParts, weekStart } from "./time";
import type { LocalDate } from "./types";

export const MAX_PATTERN_WEEKS = 4;
export const MAX_FILL_WEEKS = 12;

export interface PatternBreak {
  /** Minutes after the shift starts. */
  offsetMinutes: number;
  minutes: number;
}

/** One shift in a pattern. Everything other than the times is copied as it is. */
export interface PatternSlot<T = unknown> {
  /** 0 for the pattern's first week. */
  weekIndex: number;
  /** 0 = Monday ... 6 = Sunday. */
  weekday: number;
  startTime: string;
  endTime: string;
  /** True when the shift finishes the next morning. */
  endsNextDay: boolean;
  breaks: PatternBreak[];
  details: T;
}

const hhmm = (p: { hour: number; minute: number }) => `${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}`;
const daysBetween = (a: LocalDate, b: LocalDate) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86_400_000);

/**
 * Turns real shifts from `weeks` weeks starting on the Monday `firstWeek` into a pattern.
 * Shifts starting outside those weeks are ignored.
 */
export const capturePattern = <T>(
  shifts: { start: number; end: number; breaks: { start: number; end: number }[]; details: T }[],
  firstWeek: LocalDate,
  weeks: number,
): PatternSlot<T>[] => {
  const monday = weekStart(firstWeek);
  return shifts
    .map((s) => {
      const start = londonParts(s.start);
      const end = londonParts(s.end);
      const day = daysBetween(monday, start.date);
      return { s, start, end, day };
    })
    .filter(({ day }) => day >= 0 && day < weeks * 7)
    .sort((a, b) => a.s.start - b.s.start)
    .map(({ s, start, end, day }) => ({
      weekIndex: Math.floor(day / 7),
      weekday: day % 7,
      startTime: hhmm(start),
      endTime: hhmm(end),
      endsNextDay: end.date !== start.date,
      breaks: s.breaks.map((b) => ({ offsetMinutes: Math.round((b.start - s.start) / 60_000), minutes: Math.round((b.end - b.start) / 60_000) })),
      details: s.details,
    }));
};

export interface PatternShift<T> {
  date: LocalDate;
  start: number;
  end: number;
  breaks: { start: number; end: number }[];
  details: T;
}

/**
 * The shifts a pattern gives for `weeks` weeks from the Monday `fromWeek`. `startAtWeek` (0-based)
 * says which week of the pattern the first of those weeks is, so a rotation can carry on from
 * where it left off.
 */
export const expandPattern = <T>(slots: PatternSlot<T>[], patternWeeks: number, fromWeek: LocalDate, weeks: number, startAtWeek = 0): PatternShift<T>[] => {
  const monday = weekStart(fromWeek);
  const out: PatternShift<T>[] = [];
  for (let w = 0; w < weeks; w++) {
    const patternWeek = (startAtWeek + w) % patternWeeks;
    for (const slot of slots.filter((s) => s.weekIndex === patternWeek)) {
      const date = addDays(monday, w * 7 + slot.weekday);
      const start = londonDateTime(date, slot.startTime);
      const end = londonDateTime(slot.endsNextDay ? addDays(date, 1) : date, slot.endTime);
      if (end <= start) continue;
      out.push({
        date,
        start,
        end,
        breaks: slot.breaks
          .map((b) => ({ start: start + b.offsetMinutes * 60_000, end: start + (b.offsetMinutes + b.minutes) * 60_000 }))
          .filter((b) => b.start >= start && b.end <= end && b.end > b.start),
        details: slot.details,
      });
    }
  }
  return out.sort((a, b) => a.start - b.start);
};
