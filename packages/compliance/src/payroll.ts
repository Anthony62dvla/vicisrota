import { irregularHoursAccrual } from "./holiday";
import { minimumWage } from "./rules/minimumWage";
import { travelTimeMinimumWage } from "./rules/travelTime";
import { addDays, HOUR, londonParts, ms, workedMillis } from "./time";
import type { Finding, Leave, LocalDate, PayRate, Shift, Worker } from "./types";

export interface PayrollWorker extends Worker {
  /** Irregular hours or part-year: holiday builds up at 12.07% of hours worked. */
  irregularHours?: boolean;
}

/** Annual leave with the days or hours it takes from the holiday balance. */
export interface PayrollLeave extends Leave {
  days?: number | null;
  hours?: number | null;
}

export interface PayrollLine {
  workerId: string;
  name: string;
  /** Confirmed hours worked, after unpaid breaks. */
  hours: number;
  /** Care: hours travelling between visits. Paid at the hourly rate when the business pays travel time. */
  travelHours: number;
  grossPence: number;
  /** Hourly rates used in the period, in pence. More than one if pay changed mid-period. */
  ratesPence: number[];
  /** Irregular-hours workers only: holiday hours built up from this period's work. */
  holidayHoursAccrued: number | null;
  holidayDays: number;
  holidayHours: number;
  /** Calendar days of each kind of leave that fall inside the period. */
  sickDays: number;
  otherLeaveDays: number;
  /** Minimum wage problems; the export flags these so payroll is not run on them unchecked. */
  findings: Finding[];
}

const latestOnOrBefore = (rates: PayRate[], date: LocalDate) =>
  rates.filter((r) => r.effectiveFrom <= date).sort((a, b) => (a.effectiveFrom < b.effectiveFrom ? 1 : -1))[0];

/** Calendar days of [startsOn, endsOn] that fall within [from, to]. */
const daysInside = (startsOn: LocalDate, endsOn: LocalDate, from: LocalDate, to: LocalDate) => {
  const a = startsOn > from ? startsOn : from;
  const b = endsOn < to ? endsOn : to;
  if (a > b) return 0;
  let n = 0;
  for (let d = a; d <= b; d = addDays(d, 1)) n++;
  return n;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Pay summary for a pay period from confirmed hours. Each piece of work is paid at the rate in force
 * on the day it started. Holiday taken is counted when the leave starts in the period, matching how
 * it was booked; sickness and other leave are counted by calendar day.
 */
export const payrollSummary = (input: {
  from: LocalDate;
  to: LocalDate;
  workers: PayrollWorker[];
  entries: Shift[];
  payRates: PayRate[];
  leave?: PayrollLeave[];
  paysTravelTime?: boolean;
}): PayrollLine[] => {
  const { from, to } = input;
  const ctx = { asOf: to, workers: input.workers, shifts: input.entries, payRates: input.payRates, settings: { paysTravelTime: input.paysTravelTime ?? false } };
  const nmw = [...minimumWage.check(ctx), ...travelTimeMinimumWage.check(ctx)];
  return input.workers.map((worker) => {
    const entries = input.entries.filter((e) => e.workerId === worker.id);
    const rates = input.payRates.filter((r) => r.workerId === worker.id);
    let millis = 0;
    let travelMinutes = 0;
    let pence = 0;
    const used = new Set<number>();
    for (const e of entries) {
      const worked = workedMillis(e);
      millis += worked;
      const rate = latestOnOrBefore(rates, londonParts(ms(e.start)).date);
      travelMinutes += e.travelMinutesBefore ?? 0;
      if (rate) {
        const paidTravel = input.paysTravelTime ? (e.travelMinutesBefore ?? 0) / 60 : 0;
        pence += (worked / HOUR + paidTravel) * rate.hourlyPence;
        used.add(rate.hourlyPence);
      }
    }
    const hours = round2(millis / HOUR);
    const travelHours = round2(travelMinutes / 60);
    const leave = (input.leave ?? []).filter((l) => l.workerId === worker.id && l.status === "approved");
    const annual = leave.filter((l) => l.kind === "annual" && l.startsOn >= from && l.startsOn <= to);
    return {
      workerId: worker.id,
      name: worker.name,
      hours,
      travelHours,
      grossPence: Math.round(pence),
      ratesPence: [...used].sort((a, b) => a - b),
      // Travel between visits is working time, so it counts towards holiday built up.
      holidayHoursAccrued: worker.irregularHours ? irregularHoursAccrual(hours + travelHours) : null,
      holidayDays: annual.reduce((s, l) => s + (l.days ?? 0), 0),
      holidayHours: round2(annual.reduce((s, l) => s + (l.hours ?? 0), 0)),
      sickDays: leave.filter((l) => l.kind === "sick").reduce((s, l) => s + daysInside(l.startsOn, l.endsOn, from, to), 0),
      otherLeaveDays: leave
        .filter((l) => l.kind !== "sick" && l.kind !== "annual")
        .reduce((s, l) => s + daysInside(l.startsOn, l.endsOn, from, to), 0),
      findings: nmw.filter((f) => f.workerId === worker.id),
    };
  });
};

/** Cells starting with these could run as formulas in a spreadsheet, so they are made plain text. */
const FORMULA_START = /^[=+\-@\t\r]/;

export const csvCell = (value: string | number | null | undefined): string => {
  if (value === null || value === undefined) return "";
  let s = String(value);
  if (typeof value === "string" && FORMULA_START.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export const toCsv = (rows: (string | number | null | undefined)[][]): string => rows.map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
