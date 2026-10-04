/**
 * Working time records (Working Time Regulations 1998, regs 4, 5A and 9). Employers must keep records
 * that show each person's average working week stays within 48 hours (unless they opted out) and that
 * under-18s work no more than 40 hours a week, and keep them for two years.
 *
 * The average is taken over 17 whole weeks (Monday to Sunday). Days of holiday, sickness and family
 * leave are "excluded days" and must not pull the average down. The regulations replace them with the
 * same number of days worked straight after the period; looking back, VicisRota instead leaves those
 * weeks out of the divisor, which gives the same answer when the person works at their usual pace.
 */
import { HOUR, addDays, isYoungWorker, londonInstant, londonParts, ms, weekStart, workedMillis } from "./time";
import type { Leave, LocalDate, Shift, Worker } from "./types";

export const REFERENCE_WEEKS = 17;
export const ADULT_WEEKLY_LIMIT = 48;
export const YOUNG_WEEKLY_LIMIT = 40;
/** Averages this close to 48 hours are flagged so a manager can act before the limit is reached. */
export const CLOSE_TO_LIMIT = 44;

export type WorkingTimeStatus = "ok" | "close" | "over" | "opted_out" | "no_hours";

export interface WorkingTimeLine {
  workerId: string;
  name: string;
  young: boolean;
  optedOut: boolean;
  /** Hours worked in each of the 17 weeks, oldest first. */
  weeks: { startsOn: LocalDate; hours: number; excludedDays: number }[];
  totalHours: number;
  /** Weeks of leave or sickness left out of the average. */
  excludedWeeks: number;
  /** Null when every week was leave or sickness, or nothing was worked. */
  averageHours: number | null;
  highestWeekHours: number;
  /** Under-18s only: weeks over 40 hours. */
  weeksOverYoungLimit: number;
  status: WorkingTimeStatus;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/** The 17 whole weeks before the week containing `today`: [first Monday, last Sunday]. */
export const referencePeriod = (today: LocalDate) => {
  const to = addDays(weekStart(today), -1);
  return { from: addDays(to, -(REFERENCE_WEEKS * 7 - 1)), to };
};

/**
 * Working time for each person over the reference period ending before `today`.
 * `worked` should be confirmed hours (what actually happened), not the planned rota.
 */
export function workingTimeReport(input: {
  today: LocalDate;
  workers: (Worker & { daysPerWeek?: number })[];
  worked: Shift[];
  leave: Leave[];
}): WorkingTimeLine[] {
  const { from, to } = referencePeriod(input.today);
  const weekStarts = Array.from({ length: REFERENCE_WEEKS }, (_, i) => addDays(from, i * 7));
  const periodStart = londonInstant(from, 0);
  const periodEnd = londonInstant(addDays(to, 1), 0);

  return input.workers.map((worker) => {
    const young = isYoungWorker(worker, to);
    const optedOut = Boolean(worker.optedOutOf48HourLimit) && !young;
    const daysPerWeek = Math.min(7, Math.max(1, worker.daysPerWeek ?? 5));
    const hoursByWeek = new Map(weekStarts.map((w) => [w, 0]));
    for (const s of input.worked) {
      if (s.workerId !== worker.id || ms(s.start) < periodStart || ms(s.start) >= periodEnd) continue;
      const week = weekStart(londonParts(ms(s.start)).date);
      hoursByWeek.set(week, (hoursByWeek.get(week) ?? 0) + workedMillis(s) / HOUR);
    }
    const leaveDays = new Set<LocalDate>();
    for (const l of input.leave) {
      if (l.workerId !== worker.id || l.status !== "approved" || !["annual", "sick", "family"].includes(l.kind)) continue;
      for (let d = l.startsOn > from ? l.startsOn : from; d <= l.endsOn && d <= to; d = addDays(d, 1)) leaveDays.add(d);
    }
    const weeks = weekStarts.map((startsOn) => {
      let excludedDays = 0;
      for (let i = 0; i < 7; i++) if (leaveDays.has(addDays(startsOn, i))) excludedDays++;
      return { startsOn, hours: round1(hoursByWeek.get(startsOn) ?? 0), excludedDays };
    });
    const totalHours = round1(weeks.reduce((s, w) => s + w.hours, 0));
    // A week counts as excluded in proportion to the working days it lost, at most one whole week.
    const excludedWeeks = round1(weeks.reduce((s, w) => s + Math.min(1, w.excludedDays / daysPerWeek), 0));
    const divisor = REFERENCE_WEEKS - excludedWeeks;
    const averageHours = divisor > 0 && totalHours > 0 ? round1(totalHours / divisor) : null;
    const highestWeekHours = Math.max(0, ...weeks.map((w) => w.hours));
    const weeksOverYoungLimit = young ? weeks.filter((w) => w.hours > YOUNG_WEEKLY_LIMIT).length : 0;

    let status: WorkingTimeStatus;
    if (averageHours === null && !weeksOverYoungLimit) status = "no_hours";
    else if (young) status = weeksOverYoungLimit ? "over" : highestWeekHours > YOUNG_WEEKLY_LIMIT - 4 ? "close" : "ok";
    else if (optedOut) status = "opted_out";
    else status = averageHours! > ADULT_WEEKLY_LIMIT ? "over" : averageHours! > CLOSE_TO_LIMIT ? "close" : "ok";

    return {
      workerId: worker.id,
      name: worker.name,
      young,
      optedOut,
      weeks,
      totalHours,
      excludedWeeks,
      averageHours,
      highestWeekHours,
      weeksOverYoungLimit,
      status,
    };
  });
}

/** Hours of a piece of work that fall between 23:00 and 06:00 UK time, the default night period (reg 2). */
export const nightHours = (s: Shift) => {
  const start = ms(s.start);
  const end = ms(s.end);
  let total = 0;
  for (let d = addDays(londonParts(start).date, -1); londonInstant(d, 0) < end; d = addDays(d, 1)) {
    const from = londonInstant(d, 23);
    const to = londonInstant(addDays(d, 1), 6);
    total += Math.max(0, Math.min(end, to) - Math.max(start, from));
  }
  return round1(total / HOUR);
};
