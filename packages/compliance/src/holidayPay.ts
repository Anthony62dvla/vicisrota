import { payrollSummary, type PayrollWorker } from "./payroll";
import { addDays, londonParts, ms, weekStart } from "./time";
import type { LocalDate, PayRate, Shift } from "./types";

export const HOLIDAY_PAY_LEGAL_REF = "Working Time Regulations 1998, regs 16 and 16A; Employment Rights Act 1996, ss 221 to 224 (52-week reference period)";

/** Paid weeks used for the average, and how far back to look for them. */
export const HOLIDAY_PAY_WEEKS = 52;
export const HOLIDAY_PAY_LOOKBACK_WEEKS = 104;

export interface PayWeek {
  weekStart: LocalDate;
  pence: number;
  hours: number;
}

/**
 * Each person's pay for each Monday-to-Sunday week, from confirmed hours, sleep-ins and paid travel. Tips
 * are left out: they are not paid by the employer as wages.
 */
export const weeklyPay = (input: {
  workers: PayrollWorker[];
  entries: Shift[];
  payRates: PayRate[];
  paysTravelTime?: boolean;
  sleepInPence?: number | null;
}): Map<string, PayWeek[]> => {
  const byWeek = new Map<LocalDate, Shift[]>();
  for (const e of input.entries) {
    const week = weekStart(londonParts(ms(e.start)).date);
    byWeek.set(week, [...(byWeek.get(week) ?? []), e]);
  }
  const out = new Map<string, PayWeek[]>(input.workers.map((w) => [w.id, []]));
  for (const [week, entries] of [...byWeek].sort(([a], [b]) => (a < b ? -1 : 1))) {
    const workers = input.workers.filter((w) => entries.some((e) => e.workerId === w.id));
    const lines = payrollSummary({ ...input, from: week, to: addDays(week, 6), workers, entries });
    for (const l of lines) out.get(l.workerId)?.push({ weekStart: week, pence: l.grossPence, hours: l.hours + (input.paysTravelTime ? l.travelHours : 0) });
  }
  return out;
};

export interface HolidayPayRate {
  /** Paid weeks found, up to 52. Fewer for someone who has not worked here that long. */
  weeksUsed: number;
  /** A week's pay: the average over those weeks, in pence. */
  weekPence: number;
  /** The average pay for each hour worked, in pence, for holiday counted in hours. */
  hourPence: number | null;
}

/**
 * A week's pay for holiday starting on `startsOn`: the average of the last 52 weeks in which the person was
 * paid, going back no more than 104 weeks. Weeks with no pay are skipped. Null with no paid weeks at all.
 */
export const holidayPayRate = (weeks: PayWeek[], startsOn: LocalDate): HolidayPayRate | null => {
  const before = weekStart(startsOn);
  const earliest = addDays(before, -7 * HOLIDAY_PAY_LOOKBACK_WEEKS);
  const used = weeks
    .filter((w) => w.weekStart < before && w.weekStart >= earliest && w.pence > 0)
    .sort((a, b) => (a.weekStart < b.weekStart ? 1 : -1))
    .slice(0, HOLIDAY_PAY_WEEKS);
  if (!used.length) return null;
  const pence = used.reduce((s, w) => s + w.pence, 0);
  const hours = used.reduce((s, w) => s + w.hours, 0);
  return { weeksUsed: used.length, weekPence: Math.round(pence / used.length), hourPence: hours > 0 ? Math.round(pence / hours) : null };
};

/** Holiday pay for time taken: days at a week's pay shared over the days they work, or hours at the hourly average. */
export const holidayPayFor = (rate: HolidayPayRate, taken: { days?: number | null; hours?: number | null }, daysPerWeek: number) => {
  if (taken.hours) return rate.hourPence == null ? null : Math.round(rate.hourPence * taken.hours);
  if (taken.days) return Math.round((rate.weekPence / Math.min(7, Math.max(0.5, daysPerWeek))) * taken.days);
  return 0;
};
