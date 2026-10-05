import type { LocalDate, PayRate } from "./types";

/**
 * Employment Rights Act 2025: workers get paid when a shift is cancelled, moved or cut short at short
 * notice. Not yet in force (the government expects 2027), and the notice period and amount will be set by
 * regulations, so each business chooses both here and can switch it on early as good practice.
 */
export const SHORT_NOTICE_LEGAL_REF = "Employment Rights Act 2025, right to payment for shifts cancelled, moved or curtailed at short notice (regulations to follow)";

export type ShortNoticeKind = "cancelled" | "moved" | "shortened";

export interface ShortNoticeShift {
  start: Date;
  end: Date;
  /** Unpaid break minutes in the shift. */
  breakMinutes?: number;
}

export interface ShortNoticePay {
  kind: ShortNoticeKind;
  /** Paid minutes of the original shift the person no longer works. */
  lostMinutes: number;
  /** Whole hours between the change and the original start. */
  noticeHours: number;
  pence: number;
}

const MINUTE = 60_000;

const rateOn = (rates: PayRate[], date: LocalDate) =>
  rates.filter((r) => r.effectiveFrom <= date).sort((a, b) => (a.effectiveFrom < b.effectiveFrom ? 1 : -1))[0];

/**
 * What a person is owed when their published shift changes. `after` is the same person's shift after the
 * change, or null if they no longer have it (cancelled, made open or given to someone else). Only the time
 * of the original shift they lose counts, with unpaid breaks taken off in proportion. Nothing is owed when
 * the change gave enough notice, when no time was lost, or when the business has not switched this on.
 */
export const shortNoticePay = (input: {
  before: ShortNoticeShift;
  after: ShortNoticeShift | null;
  changedAt: Date;
  /** Null when the business has not switched short-notice pay on. */
  noticeHours: number | null;
  /** Share of lost pay owed, 100 = full pay. */
  percent: number;
  /** The person's pay rates; the one in force on the shift's UK date is used. */
  rates: PayRate[];
  /** The original shift's date in the UK, for choosing the pay rate. */
  shiftDate: LocalDate;
}): ShortNoticePay | null => {
  const { before, after, changedAt, noticeHours, percent } = input;
  if (noticeHours === null) return null;
  const warning = before.start.getTime() - changedAt.getTime();
  // Changes after the shift started are not notice of anything; hours worked are paid from the timesheet.
  if (warning <= 0 || warning >= noticeHours * 60 * MINUTE) return null;
  const length = before.end.getTime() - before.start.getTime();
  if (length <= 0) return null;
  const overlap = after ? Math.max(0, Math.min(before.end.getTime(), after.end.getTime()) - Math.max(before.start.getTime(), after.start.getTime())) : 0;
  const lost = length - overlap;
  if (lost <= 0) return null;
  const paidShare = Math.max(0, length - (before.breakMinutes ?? 0) * MINUTE) / length;
  const lostMinutes = Math.round((lost * paidShare) / MINUTE);
  if (lostMinutes <= 0) return null;
  const inside = after && after.start.getTime() >= before.start.getTime() && after.end.getTime() <= before.end.getTime();
  const kind: ShortNoticeKind = !after ? "cancelled" : inside ? "shortened" : "moved";
  const rate = rateOn(input.rates, input.shiftDate);
  const pence = rate ? Math.round(((lostMinutes / 60) * rate.hourlyPence * percent) / 100) : 0;
  return { kind, lostMinutes, noticeHours: Math.floor(warning / (60 * MINUTE)), pence };
};
