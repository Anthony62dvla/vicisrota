import { addDays, londonDateTime, londonParts, type Context } from "@vicisrota/compliance";
import { schema, type Transaction } from "@vicisrota/db";
import { and, gte, inArray, lt, ne } from "drizzle-orm";

/** The 48-hour rule averages over 17 weeks, so checks load that much history before the week. */
const HISTORY_WEEKS = 17;

/** Start and end of a Monday-to-Sunday UK week. */
export const weekBounds = (weekStart: string) => ({
  from: new Date(londonDateTime(weekStart, "00:00")),
  to: new Date(londonDateTime(addDays(weekStart, 7), "00:00")),
});

/**
 * Loads everything the compliance engine needs to check one week: staff, pay rates, and every
 * non-cancelled shift from 17 weeks before the week to its end. Runs inside withOrganisation.
 */
export const loadComplianceContext = async (tx: Transaction, weekStart: string): Promise<Context> => {
  const { from } = weekBounds(addDays(weekStart, -7 * HISTORY_WEEKS));
  const { to } = weekBounds(weekStart);

  const [workers, rates, shifts] = await Promise.all([
    tx.select().from(schema.worker),
    tx.select().from(schema.payRate),
    tx
      .select()
      .from(schema.shift)
      .where(and(gte(schema.shift.startsAt, from), lt(schema.shift.startsAt, to), ne(schema.shift.status, "cancelled"))),
  ]);
  const assigned = shifts.filter((s) => s.workerId);
  const breaks = assigned.length
    ? await tx.select().from(schema.shiftBreak).where(inArray(schema.shiftBreak.shiftId, assigned.map((s) => s.id)))
    : [];

  return {
    // The last day of the week, so 17-week averages end with the week being checked.
    asOf: addDays(weekStart, 6),
    workers: workers.map((w) => ({
      id: w.id,
      name: w.fullName,
      dateOfBirth: w.dateOfBirth,
      optedOutOf48HourLimit: w.optedOutOf48HourLimit,
      apprenticeRateApplies: w.apprenticeRateApplies,
    })),
    payRates: rates.map((r) => ({ workerId: r.workerId, hourlyPence: r.hourlyPence, effectiveFrom: r.effectiveFrom })),
    shifts: assigned.map((s) => ({
      id: s.id,
      workerId: s.workerId!,
      start: s.startsAt.toISOString(),
      end: s.endsAt.toISOString(),
      breaks: breaks
        .filter((b) => b.shiftId === s.id)
        .map((b) => ({ start: b.startsAt.toISOString(), end: b.endsAt.toISOString() })),
    })),
  };
};

/** Today's date in the UK. */
export const todayInUk = () => londonParts(Date.now()).date;
