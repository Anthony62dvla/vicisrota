import {
  DAY,
  HOUR,
  MINUTE,
  addDays,
  fmtHours,
  fmtMinutes,
  isYoungWorker,
  londonInstant,
  londonParts,
  longestBreakMillis,
  ms,
  overlap,
  shiftsByWorker,
  weekStart,
  workedMillis,
} from "../time";
import type { Context, Finding, Rule, Shift, Worker } from "../types";

const WTR = "Working Time Regulations 1998";

const workersById = (ctx: Context) => new Map(ctx.workers.map((w) => [w.id, w]));

/** Runs `fn` for each worker who has shifts, with their shifts in start order. */
const perWorker = (ctx: Context, fn: (worker: Worker, shifts: Shift[]) => Finding[]): Finding[] => {
  const workers = workersById(ctx);
  const findings: Finding[] = [];
  for (const [workerId, shifts] of shiftsByWorker(ctx.shifts)) {
    const worker = workers.get(workerId);
    if (!worker) throw new Error(`Shift for unknown worker ${workerId}`);
    findings.push(...fn(worker, shifts));
  }
  return findings;
};

const shiftDate = (s: Shift) => londonParts(ms(s.start)).date;

export const restBreak: Rule = {
  id: "wtr.rest-break",
  version: 1,
  title: "Rest break during the shift",
  legalRef: `${WTR}, regs 12 and 12(4)`,
  effectiveFrom: "1998-10-01",
  check(ctx) {
    return perWorker(ctx, (worker, shifts) =>
      shifts.flatMap((shift): Finding[] => {
        const young = isYoungWorker(worker, shiftDate(shift));
        const threshold = young ? 4.5 * HOUR : 6 * HOUR;
        const required = young ? 30 * MINUTE : 20 * MINUTE;
        const worked = workedMillis(shift);
        const longest = longestBreakMillis(shift);
        if (worked <= threshold || longest >= required) return [];
        return [
          {
            ruleId: this.id,
            ruleVersion: this.version,
            severity: "block",
            workerId: worker.id,
            shiftIds: [shift.id],
            message: `${worker.name} works ${fmtHours(worked)} without an unbroken ${fmtMinutes(required)} break${
              young ? " (under 18)" : ""
            }. Add a break of at least ${fmtMinutes(required)}.`,
            evidence: { workedHours: worked / HOUR, longestBreakMinutes: longest / MINUTE, requiredMinutes: required / MINUTE, young },
            legalRef: this.legalRef,
          },
        ];
      }),
    );
  },
};

export const dailyRest: Rule = {
  id: "wtr.daily-rest",
  version: 1,
  title: "Rest between shifts",
  legalRef: `${WTR}, reg 10`,
  effectiveFrom: "1998-10-01",
  check(ctx) {
    return perWorker(ctx, (worker, shifts) =>
      shifts.slice(1).flatMap((next, i): Finding[] => {
        const prev = shifts[i]!;
        const young = isYoungWorker(worker, shiftDate(next));
        const required = (young ? 12 : 11) * HOUR;
        const gap = ms(next.start) - ms(prev.end);
        if (gap >= required) return [];
        return [
          {
            ruleId: this.id,
            ruleVersion: this.version,
            severity: "block",
            workerId: worker.id,
            shiftIds: [prev.id, next.id],
            message: `${worker.name} gets ${fmtHours(gap)} rest between shifts; ${fmtHours(required)} is required${
              young ? " for under-18s" : ""
            }.`,
            evidence: { restHours: gap / HOUR, requiredHours: required / HOUR, young },
            legalRef: this.legalRef,
          },
        ];
      }),
    );
  },
};

/** Weeks (Monday start, UK time) touched by the given shifts. */
const weeksTouched = (shifts: Shift[]): string[] =>
  [...new Set(shifts.flatMap((s) => [weekStart(shiftDate(s)), weekStart(londonParts(ms(s.end)).date)]))].sort();

export const weeklyRest: Rule = {
  id: "wtr.weekly-rest",
  version: 1,
  title: "Weekly rest",
  legalRef: `${WTR}, reg 11`,
  effectiveFrom: "1998-10-01",
  check(ctx) {
    return perWorker(ctx, (worker, shifts) =>
      weeksTouched(shifts).flatMap((monday): Finding[] => {
        const from = londonInstant(monday, 0);
        const to = londonInstant(addDays(monday, 7), 0);
        const inWeek = shifts.filter((s) => overlap(ms(s.start), ms(s.end), from, to) > 0);
        // Longest uninterrupted time off inside the week, counting from the week's edges.
        let cursor = from;
        let longest = 0;
        for (const s of inWeek) {
          longest = Math.max(longest, ms(s.start) - cursor);
          cursor = Math.max(cursor, ms(s.end));
        }
        longest = Math.max(longest, to - cursor);
        const young = isYoungWorker(worker, monday);
        const required = (young ? 48 : 24) * HOUR;
        if (longest >= required) return [];
        return [
          {
            ruleId: this.id,
            ruleVersion: this.version,
            severity: "block",
            workerId: worker.id,
            shiftIds: inWeek.map((s) => s.id),
            message: `${worker.name}'s longest break in the week of ${monday} is ${fmtHours(longest)}; ${fmtHours(
              required,
            )} uninterrupted rest is required${young ? " for under-18s" : ""}.`,
            evidence: { weekStart: monday, longestRestHours: longest / HOUR, requiredHours: required / HOUR, young },
            legalRef: this.legalRef,
          },
        ];
      }),
    );
  },
};

export const weeklyAverage48: Rule = {
  id: "wtr.48-hour-average",
  version: 1,
  title: "48-hour average working week",
  legalRef: `${WTR}, regs 4 and 5`,
  effectiveFrom: "1998-10-01",
  check(ctx) {
    const referenceWeeks = 17;
    const periodEnd = londonInstant(addDays(ctx.asOf, 1), 0);
    const periodStart = periodEnd - referenceWeeks * 7 * DAY;
    return perWorker(ctx, (worker, shifts): Finding[] => {
      if (worker.optedOutOf48HourLimit) return [];
      const inPeriod = shifts.filter((s) => ms(s.start) >= periodStart && ms(s.start) < periodEnd);
      const total = inPeriod.reduce((sum, s) => sum + workedMillis(s), 0);
      const average = total / referenceWeeks;
      if (average <= 48 * HOUR) return [];
      return [
        {
          ruleId: this.id,
          ruleVersion: this.version,
          severity: "block",
          workerId: worker.id,
          shiftIds: inPeriod.map((s) => s.id),
          message: `${worker.name} averages ${fmtHours(average)} a week over ${referenceWeeks} weeks, above the 48h limit, and has not opted out.`,
          evidence: { averageWeeklyHours: average / HOUR, referenceWeeks, optedOut: false },
          legalRef: this.legalRef,
        },
      ];
    });
  },
};

export const youngWorkerHours: Rule = {
  id: "wtr.young-worker-hours",
  version: 1,
  title: "Under-18 daily and weekly hours",
  legalRef: `${WTR}, reg 5A`,
  effectiveFrom: "2003-08-06",
  check(ctx) {
    return perWorker(ctx, (worker, shifts) => {
      const byDay = new Map<string, Shift[]>();
      const byWeek = new Map<string, Shift[]>();
      for (const s of shifts) {
        const date = shiftDate(s);
        if (!isYoungWorker(worker, date)) continue;
        byDay.set(date, [...(byDay.get(date) ?? []), s]);
        byWeek.set(weekStart(date), [...(byWeek.get(weekStart(date)) ?? []), s]);
      }
      const over = (groups: Map<string, Shift[]>, limit: number, period: string): Finding[] =>
        [...groups].flatMap(([key, group]): Finding[] => {
          const total = group.reduce((sum, s) => sum + workedMillis(s), 0);
          if (total <= limit * HOUR) return [];
          return [
            {
              ruleId: this.id,
              ruleVersion: this.version,
              severity: "block",
              workerId: worker.id,
              shiftIds: group.map((s) => s.id),
              message: `${worker.name} is under 18 and is rostered ${fmtHours(total)} ${period} ${key}; the limit is ${limit}h.`,
              evidence: { period: key, workedHours: total / HOUR, limitHours: limit },
              legalRef: this.legalRef,
            },
          ];
        });
      return [...over(byDay, 8, "on"), ...over(byWeek, 40, "in the week of")];
    });
  },
};

export const youngWorkerNight: Rule = {
  id: "wtr.young-worker-night",
  version: 1,
  title: "Under-18 night work",
  legalRef: `${WTR}, reg 6A`,
  effectiveFrom: "2003-08-06",
  check(ctx) {
    return perWorker(ctx, (worker, shifts) =>
      shifts.flatMap((shift): Finding[] => {
        const date = shiftDate(shift);
        if (!isYoungWorker(worker, date)) return [];
        const start = ms(shift.start);
        const end = ms(shift.end);
        // Restricted period 22:00 to 06:00 UK time, checked for the night before and the night of the shift.
        const nights = [addDays(date, -1), date].map((d) => [londonInstant(d, 22), londonInstant(addDays(d, 1), 6)] as const);
        const inNight = nights.reduce((sum, [from, to]) => sum + overlap(start, end, from, to), 0);
        if (inNight === 0) return [];
        return [
          {
            ruleId: this.id,
            ruleVersion: this.version,
            severity: "block",
            workerId: worker.id,
            shiftIds: [shift.id],
            message: `${worker.name} is under 18 and this shift runs ${fmtMinutes(inNight)} between 10pm and 6am.`,
            evidence: { nightMinutes: inNight / MINUTE },
            legalRef: this.legalRef,
          },
        ];
      }),
    );
  },
};
