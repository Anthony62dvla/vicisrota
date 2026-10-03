import { addDays, londonDateTime, payrollSummary } from "@vicisrota/compliance";
import { schema, type Transaction } from "@vicisrota/db";
import { and, eq, gte, isNull, lt, lte } from "drizzle-orm";

const MINUTE = 60_000;

/** The instants a pay period covers: from 00:00 on the first day to 00:00 after the last, UK time. */
export const periodBounds = (from: string, to: string) => ({
  start: new Date(londonDateTime(from, "00:00")),
  end: new Date(londonDateTime(addDays(to, 1), "00:00")),
});

/** Confirmed hours, pay and leave for a pay period. Runs inside withOrganisation. */
export const loadPayroll = async (tx: Transaction, from: string, to: string) => {
  const { start, end } = periodBounds(from, to);
  const [workers, rates, entries, leave, unconfirmed] = await Promise.all([
    tx.select().from(schema.worker),
    tx.select().from(schema.payRate),
    tx.select().from(schema.timeEntry).where(and(gte(schema.timeEntry.startsAt, start), lt(schema.timeEntry.startsAt, end))),
    tx
      .select()
      .from(schema.leaveRequest)
      .where(and(eq(schema.leaveRequest.status, "approved"), lte(schema.leaveRequest.startsOn, to), gte(schema.leaveRequest.endsOn, from))),
    tx
      .select({ id: schema.shift.id, workerId: schema.shift.workerId })
      .from(schema.shift)
      .leftJoin(schema.timeEntry, eq(schema.timeEntry.shiftId, schema.shift.id))
      .where(
        and(
          eq(schema.shift.status, "published"),
          gte(schema.shift.startsAt, start),
          lt(schema.shift.startsAt, end),
          lt(schema.shift.startsAt, new Date()),
          // Worked shifts with no confirmed hours yet.
          isNull(schema.timeEntry.id),
        ),
      ),
  ]);

  const lines = payrollSummary({
    from,
    to,
    workers: workers.map((w) => ({
      id: w.id,
      name: w.fullName,
      dateOfBirth: w.dateOfBirth,
      apprenticeRateApplies: w.apprenticeRateApplies,
      irregularHours: w.irregularHours,
    })),
    entries: entries.map((e) => ({
      id: e.id,
      workerId: e.workerId,
      start: e.startsAt.toISOString(),
      end: e.endsAt.toISOString(),
      breaks: e.breakMinutes
        ? [{ start: e.startsAt.toISOString(), end: new Date(e.startsAt.getTime() + e.breakMinutes * MINUTE).toISOString() }]
        : [],
    })),
    payRates: rates.map((r) => ({ workerId: r.workerId, hourlyPence: r.hourlyPence, effectiveFrom: r.effectiveFrom })),
    leave: leave.map((l) => ({ ...l, status: "approved" as const })),
  }).filter((l) => l.hours > 0 || l.holidayDays > 0 || l.holidayHours > 0 || l.sickDays > 0 || l.otherLeaveDays > 0);

  return { lines, unconfirmed: unconfirmed.length };
};
