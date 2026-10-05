import { HOUR, addDays, fmtHours, londonInstant, londonParts, ms, overlap, shiftsByWorker } from "../time";
import type { Context, Finding, LocalDate, Rule, Shift, Worker } from "../types";

/**
 * Patterns that are legal but tiring. None of these is a legal limit, so they warn and never block. The
 * limits broadly follow HSE guidance on shift work (HSG256, "Managing shift work"): shifts of no more than 12
 * hours, no more than 4 nights in a row, two full nights' sleep after a run of nights, no quick changeovers
 * (at least 12 hours between shifts on different days), and no more than 6 days in a row.
 */
const GUIDANCE = "HSE guidance HSG256, Managing shift work. Guidance, not a legal limit; the employer's duty is to assess fatigue risk (Management of Health and Safety at Work Regulations 1999, reg 3).";

export const FATIGUE_LIMITS = {
  /** Longest shift, in hours, before a warning. */
  shiftHours: 12,
  /** Most night shifts in a row before a warning. */
  nightsInARow: 4,
  /** Hours off needed after the last of a run of nights. */
  hoursAfterNights: 46,
  /** Fewest hours between shifts that start on different days. */
  hoursBetweenShifts: 12,
  /** Most days in a row with a shift. */
  daysInARow: 6,
} as const;

/** A night shift has at least 3 hours between 23:00 and 06:00, the default night time in the Working Time Regulations. */
export const isNightShift = (s: Shift) => {
  const start = ms(s.start);
  const end = ms(s.end);
  const date = londonParts(start).date;
  let night = 0;
  for (const d of [addDays(date, -1), date]) night += overlap(start, end, londonInstant(d, 23), londonInstant(addDays(d, 1), 6));
  return night >= 3 * HOUR;
};

const dateOf = (s: Shift) => londonParts(ms(s.start)).date;

const warn = (rule: Rule, worker: Worker, shifts: Shift[], message: string, evidence: Finding["evidence"]): Finding => ({
  ruleId: rule.id,
  ruleVersion: rule.version,
  severity: "warn",
  workerId: worker.id,
  shiftIds: shifts.map((s) => s.id),
  message,
  evidence,
  legalRef: rule.legalRef,
});

/** Groups shifts into runs where each one starts the calendar day after (or the same day as) the one before. */
const runsOfDays = (shifts: Shift[]): Shift[][] => {
  const runs: Shift[][] = [];
  for (const s of shifts) {
    const run = runs.at(-1);
    const last = run?.at(-1);
    if (run && last && (dateOf(s) === dateOf(last) || dateOf(s) === addDays(dateOf(last), 1))) run.push(s);
    else runs.push([s]);
  }
  return runs;
};

const days = (run: Shift[]): LocalDate[] => [...new Set(run.map(dateOf))];

const eachWorker = (ctx: Context, fn: (worker: Worker, shifts: Shift[]) => Finding[]) => {
  const workers = new Map(ctx.workers.map((w) => [w.id, w]));
  return [...shiftsByWorker(ctx.shifts)].flatMap(([id, shifts]) => {
    const worker = workers.get(id);
    return worker ? fn(worker, shifts) : [];
  });
};

export const fatigue: Rule = {
  id: "fatigue.patterns",
  version: 1,
  title: "Tiring shift patterns",
  legalRef: GUIDANCE,
  effectiveFrom: "2000-01-01",
  check(ctx) {
    return eachWorker(ctx, (worker, shifts) => {
      const out: Finding[] = [];

      // Very long shifts.
      for (const s of shifts) {
        const length = ms(s.end) - ms(s.start);
        if (length > FATIGUE_LIMITS.shiftHours * HOUR) {
          out.push(warn(this, worker, [s], `${worker.name}'s shift on ${dateOf(s)} is ${fmtHours(length)} long. Shifts over ${FATIGUE_LIMITS.shiftHours} hours are tiring.`, { hours: length / HOUR }));
        }
      }

      // Nights in a row, and the rest after them.
      for (const run of runsOfDays(shifts.filter(isNightShift))) {
        const nights = days(run).length;
        if (nights > FATIGUE_LIMITS.nightsInARow) {
          out.push(
            warn(this, worker, run, `${worker.name} has ${nights} night shifts in a row, from ${days(run)[0]}. More than ${FATIGUE_LIMITS.nightsInARow} in a row is tiring; consider a break in the run.`, {
              nights,
              from: days(run)[0]!,
            }),
          );
        }
        const last = run.at(-1)!;
        const next = shifts.find((s) => ms(s.start) >= ms(last.end) && !run.includes(s));
        if (next && !isNightShift(next)) {
          const gap = ms(next.start) - ms(last.end);
          if (gap < FATIGUE_LIMITS.hoursAfterNights * HOUR) {
            out.push(
              warn(this, worker, [last, next], `${worker.name} starts a day shift ${fmtHours(gap)} after finishing nights. Two full nights' sleep (${FATIGUE_LIMITS.hoursAfterNights} hours) helps people recover.`, {
                gapHours: gap / HOUR,
              }),
            );
          }
        }
      }

      // Short gaps between shifts on different days, like a late finish then an early start.
      for (let i = 1; i < shifts.length; i++) {
        const before = shifts[i - 1]!;
        const after = shifts[i]!;
        if (dateOf(after) === dateOf(before)) continue;
        const gap = ms(after.start) - ms(before.end);
        if (gap >= 0 && gap < FATIGUE_LIMITS.hoursBetweenShifts * HOUR && !(isNightShift(before) && isNightShift(after))) {
          out.push(
            warn(this, worker, [before, after], `${worker.name} has only ${fmtHours(gap)} between shifts on ${dateOf(before)} and ${dateOf(after)}. At least ${FATIGUE_LIMITS.hoursBetweenShifts} hours lets people get home, sleep and eat.`, {
              gapHours: gap / HOUR,
            }),
          );
        }
      }

      // Days in a row.
      for (const run of runsOfDays(shifts)) {
        const n = days(run).length;
        if (n > FATIGUE_LIMITS.daysInARow) {
          out.push(
            warn(this, worker, run, `${worker.name} works ${n} days in a row, from ${days(run)[0]}. More than ${FATIGUE_LIMITS.daysInARow} in a row without a day off is tiring.`, {
              days: n,
              from: days(run)[0]!,
            }),
          );
        }
      }
      return out;
    });
  },
};
