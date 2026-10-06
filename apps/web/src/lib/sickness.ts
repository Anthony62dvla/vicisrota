import {
  addDays,
  londonParts,
  payrollSummary,
  statutorySickPay,
  usualWorkingWeekdays,
  type SspDay,
  type SspSpellResult,
} from "@vicisrota/compliance";
import { schema, type Transaction } from "@vicisrota/db";
import { and, eq, gte, inArray, lt, lte, ne } from "drizzle-orm";
import { periodBounds } from "./payroll";

/** Weeks of earnings averaged for SSP, ending the day before the sickness began. */
const EARNINGS_WEEKS = 8;

export type SicknessRecord = typeof schema.leaveRequest.$inferSelect & {
  ssp: SspSpellResult;
  /** True when the earnings come from confirmed hours rather than a figure the manager entered. */
  earningsEstimated: boolean;
  /** The average weekly earnings used for the period this spell belongs to, in pence. */
  earningsPence: number;
  /** First day of the linked period of sickness this spell belongs to, where its earnings are entered. */
  periodStartsOn: string;
};

export type WorkerSickness = {
  workerId: string;
  /** Days of the week used as qualifying days, 0 = Sunday. */
  qualifyingWeekdays: number[];
  records: SicknessRecord[];
  days: SspDay[];
};

/**
 * Approved sickness and Statutory Sick Pay for each person, up to and including `until`.
 * Every earlier spell is loaded so linking and the 28-week limit are right. Runs inside withOrganisation.
 */
export const loadSickness = async (tx: Transaction, until: string, workerIds?: string[]): Promise<Map<string, WorkerSickness>> => {
  const spells = await tx
    .select()
    .from(schema.leaveRequest)
    .where(
      and(
        eq(schema.leaveRequest.kind, "sick"),
        eq(schema.leaveRequest.status, "approved"),
        lte(schema.leaveRequest.startsOn, until),
        workerIds ? inArray(schema.leaveRequest.workerId, workerIds) : undefined,
      ),
    );
  const result = new Map<string, WorkerSickness>();
  if (!spells.length) return result;
  const people = [...new Set(spells.map((s) => s.workerId))];
  const earliest = spells.reduce((m, s) => (s.startsOn < m ? s.startsOn : m), spells[0]!.startsOn);
  const latest = spells.reduce((m, s) => (s.startsOn > m ? s.startsOn : m), spells[0]!.startsOn);
  const window = periodBounds(addDays(earliest, -7 * EARNINGS_WEEKS), latest);

  const [workers, rates, entries, shifts, [organisation]] = await Promise.all([
    tx.select().from(schema.worker).where(inArray(schema.worker.id, people)),
    tx.select().from(schema.payRate).where(inArray(schema.payRate.workerId, people)),
    tx
      .select()
      .from(schema.timeEntry)
      .where(and(inArray(schema.timeEntry.workerId, people), gte(schema.timeEntry.startsAt, window.start), lt(schema.timeEntry.startsAt, window.end))),
    tx
      .select({ id: schema.shift.id, workerId: schema.shift.workerId, startsAt: schema.shift.startsAt, kind: schema.shift.kind })
      .from(schema.shift)
      .where(
        and(
          inArray(schema.shift.workerId, people),
          ne(schema.shift.status, "cancelled"),
          gte(schema.shift.startsAt, window.start),
          lt(schema.shift.startsAt, window.end),
        ),
      ),
    tx.select({ sleepInPence: schema.organisation.sleepInPence }).from(schema.organisation),
  ]);
  // Sleep-in payments are earnings too.
  const sleepIns = new Set(shifts.filter((s) => s.kind === "sleep_in").map((s) => s.id));

  for (const w of workers) {
    const mine = spells.filter((s) => s.workerId === w.id);
    const latestStart = mine.reduce((m, s) => (s.startsOn > m ? s.startsOn : m), mine[0]!.startsOn);
    // Qualifying days: the days of the week they worked in the 8 weeks before their latest sickness.
    const from = addDays(latestStart, -7 * EARNINGS_WEEKS);
    const qualifyingWeekdays = usualWorkingWeekdays(
      shifts
        .filter((s) => s.workerId === w.id)
        .map((s) => londonParts(s.startsAt.getTime()).date)
        .filter((d) => d >= from && d < latestStart),
    );

    // Average weekly earnings from confirmed hours in the 8 weeks before a date, unless the manager entered a figure.
    const estimates = new Map<string, number>();
    const estimate = (startsOn: string) => {
      const cached = estimates.get(startsOn);
      if (cached !== undefined) return cached;
      const { start, end } = periodBounds(addDays(startsOn, -7 * EARNINGS_WEEKS), addDays(startsOn, -1));
      const [line] = payrollSummary({
        from: addDays(startsOn, -7 * EARNINGS_WEEKS),
        to: addDays(startsOn, -1),
        workers: [{ id: w.id, name: w.fullName, dateOfBirth: w.dateOfBirth, apprenticeRateApplies: w.apprenticeRateApplies, irregularHours: w.irregularHours }],
        entries: entries
          .filter((e) => e.workerId === w.id && e.startsAt >= start && e.startsAt < end)
          .map((e) => ({
            id: e.id,
            workerId: e.workerId,
            start: e.startsAt.toISOString(),
            end: e.endsAt.toISOString(),
            breaks: breaksOf(e),
            sleepIn: e.shiftId && sleepIns.has(e.shiftId) ? { awakeMinutes: e.awakeMinutes } : undefined,
          })),
        payRates: rates.filter((r) => r.workerId === w.id),
        leave: [],
        sleepInPence: organisation?.sleepInPence ?? null,
      });
      const weekly = Math.round((line?.grossPence ?? 0) / EARNINGS_WEEKS);
      estimates.set(startsOn, weekly);
      return weekly;
    };
    const earnings = (s: (typeof mine)[number]) => s.sspWeeklyEarningsPence ?? estimate(s.startsOn);

    // Linking decides which spell's earnings apply, so work out the periods first, then the pay.
    const { spells: shape } = statutorySickPay(mine.map((s) => ({ ...s, averageWeeklyEarningsPence: 0 })), qualifyingWeekdays);
    const startOf = new Map(shape.map((r) => [r.id, r.periodStartId]));
    const byId = new Map(mine.map((s) => [s.id, s]));
    const { spells: pay, days } = statutorySickPay(
      mine.map((s) => ({ ...s, averageWeeklyEarningsPence: s.id === startOf.get(s.id) ? earnings(s) : 0 })),
      qualifyingWeekdays,
    );
    const records = pay.map((ssp) => {
      const row = byId.get(ssp.id)!;
      const start = byId.get(ssp.periodStartId)!;
      return { ...row, ssp, earningsEstimated: start.sspWeeklyEarningsPence == null, earningsPence: earnings(start), periodStartsOn: start.startsOn };
    });
    result.set(w.id, { workerId: w.id, qualifyingWeekdays, records, days });
  }
  return result;
};

const breaksOf = (e: typeof schema.timeEntry.$inferSelect) =>
  e.breakMinutes ? [{ start: e.startsAt.toISOString(), end: new Date(e.startsAt.getTime() + e.breakMinutes * 60_000).toISOString() }] : [];

export const WEEKDAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
