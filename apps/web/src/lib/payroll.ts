import { addDays, londonDateTime, payrollSummary, sspInPeriod } from "@vicisrota/compliance";
import { schema, type Transaction } from "@vicisrota/db";
import { and, eq, gte, isNull, lt, lte } from "drizzle-orm";
import { loadSickness } from "./sickness";

const MINUTE = 60_000;

/** The instants a pay period covers: from 00:00 on the first day to 00:00 after the last, UK time. */
export const periodBounds = (from: string, to: string) => ({
  start: new Date(londonDateTime(from, "00:00")),
  end: new Date(londonDateTime(addDays(to, 1), "00:00")),
});

/** Confirmed hours, pay and leave for a pay period. Runs inside withOrganisation. */
export const loadPayroll = async (tx: Transaction, organisationId: string, from: string, to: string) => {
  const { start, end } = periodBounds(from, to);
  const [[organisation], workers, rates, entries, leave, unconfirmed] = await Promise.all([
    tx.select({ paysTravelTime: schema.organisation.paysTravelTime }).from(schema.organisation).where(eq(schema.organisation.id, organisationId)),
    tx.select().from(schema.worker),
    tx.select().from(schema.payRate),
    tx
      .select({ entry: schema.timeEntry, travelMinutes: schema.shift.travelMinutes })
      .from(schema.timeEntry)
      .leftJoin(schema.shift, eq(schema.timeEntry.shiftId, schema.shift.id))
      .where(and(gte(schema.timeEntry.startsAt, start), lt(schema.timeEntry.startsAt, end))),
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

  // Pay for shifts cancelled, moved or cut short at short notice, in the period the original shift fell in.
  const shortNoticePence = new Map<string, number>();
  for (const p of await tx
    .select({ workerId: schema.shortNoticePayment.workerId, pence: schema.shortNoticePayment.pence })
    .from(schema.shortNoticePayment)
    .where(
      and(gte(schema.shortNoticePayment.shiftStartsAt, start), lt(schema.shortNoticePayment.shiftStartsAt, end), isNull(schema.shortNoticePayment.waivedAt)),
    ))
    shortNoticePence.set(p.workerId, (shortNoticePence.get(p.workerId) ?? 0) + p.pence);

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
    entries: entries.map(({ entry: e, travelMinutes }) => ({
      travelMinutesBefore: travelMinutes ?? 0,
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
    paysTravelTime: organisation?.paysTravelTime ?? false,
  }).filter((l) => l.hours > 0 || l.travelHours > 0 || l.holidayDays > 0 || l.holidayHours > 0 || l.sickDays > 0 || l.otherLeaveDays > 0 || shortNoticePence.has(l.workerId));

  // Tips shared for periods ending in this pay period are paid with it.
  const shares = await tx
    .select({ workerId: schema.tipShare.workerId, pence: schema.tipShare.pence })
    .from(schema.tipShare)
    .innerJoin(schema.tipAllocation, eq(schema.tipShare.allocationId, schema.tipAllocation.id))
    .where(and(gte(schema.tipAllocation.periodTo, from), lte(schema.tipAllocation.periodTo, to)));
  const tipsPence = new Map<string, number>();
  for (const s of shares) tipsPence.set(s.workerId, (tipsPence.get(s.workerId) ?? 0) + s.pence);

  // Statutory Sick Pay for sick days inside this pay period. Earlier sickness is loaded too, for linking.
  const sspPence = new Map<string, number>();
  for (const [workerId, s] of await loadSickness(tx, to)) {
    const pence = sspInPeriod(s.days, from, to);
    if (pence > 0) sspPence.set(workerId, pence);
  }

  return { lines, unconfirmed: unconfirmed.length, tipsPence, sspPence, shortNoticePence };
};
