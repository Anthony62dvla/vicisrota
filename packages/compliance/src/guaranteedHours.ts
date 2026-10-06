import { addDays, weekStart } from "./time";
import type { LocalDate } from "./types";

export const GUARANTEED_HOURS_LEGAL_REF =
  "Employment Rights Act 2025, Part 1 (right to guaranteed hours for zero and low hours workers), expected from 2027, with details to be set by regulations";
export const GUARANTEED_HOURS_WEEKS = 12;

export interface HoursReview {
  /** Average paid hours a week over the reference period, including weeks with no work. */
  averageHours: number;
  /** Weeks with any work, out of the reference period. */
  weeksWorked: number;
  /** Hours to offer: the average, rounded down to the nearest half hour. */
  suggestedHours: number;
  /** They regularly work more than their contract guarantees. */
  offerDue: boolean;
  from: LocalDate;
  to: LocalDate;
}

/**
 * Looks at the 12 full weeks (Monday to Sunday) before `today` and compares the hours worked with the hours the
 * contract guarantees. The final rules are not yet set, so this is a guide for getting ready.
 */
export const reviewGuaranteedHours = (worked: { date: LocalDate; hours: number }[], contractedHours: number, today: LocalDate): HoursReview => {
  const to = addDays(weekStart(today), -1);
  const from = addDays(weekStart(today), -7 * GUARANTEED_HOURS_WEEKS);
  const inPeriod = worked.filter((w) => w.date >= from && w.date <= to);
  const total = inPeriod.reduce((t, w) => t + w.hours, 0);
  const weeksWorked = new Set(inPeriod.filter((w) => w.hours > 0).map((w) => weekStart(w.date))).size;
  const averageHours = Math.round((total / GUARANTEED_HOURS_WEEKS) * 100) / 100;
  const suggestedHours = Math.floor(averageHours * 2) / 2;
  return { averageHours, weeksWorked, suggestedHours, offerDue: suggestedHours > contractedHours, from, to };
};
