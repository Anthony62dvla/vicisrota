import { addDays, londonDateTime, londonParts, type Context } from "@vicisrota/compliance";
import { schema, type Transaction } from "@vicisrota/db";
import { and, eq, gte, inArray, lt, lte, ne } from "drizzle-orm";

/** The 48-hour rule averages over 17 weeks, so checks load that much history before the week. */
const HISTORY_WEEKS = 17;

/** Start and end of a Monday-to-Sunday UK week. */
export const weekBounds = (weekStart: string) => ({
  from: new Date(londonDateTime(weekStart, "00:00")),
  to: new Date(londonDateTime(addDays(weekStart, 7), "00:00")),
});

/**
 * Loads everything the compliance engine needs to check one week: staff, pay rates, and every
 * non-cancelled shift from 17 weeks before the week to its end, plus right to work, DBS and training
 * records, and requested or approved leave. Runs inside withOrganisation.
 */
export const loadComplianceContext = async (
  tx: Transaction,
  organisationId: string,
  weekStart: string,
  /** Check the week as if this shift were given to this person, e.g. before approving a swap. */
  assume?: { shiftId: string; workerId: string },
): Promise<Context> => {
  const { from } = weekBounds(addDays(weekStart, -7 * HISTORY_WEEKS));
  const { to } = weekBounds(weekStart);

  const [[organisation], workers, rates, shifts, checks, qualifications, held, leave, unavailable] = await Promise.all([
    tx
      .select({ requiresEnhancedDbs: schema.organisation.requiresEnhancedDbs, paysTravelTime: schema.organisation.paysTravelTime })
      .from(schema.organisation)
      .where(eq(schema.organisation.id, organisationId)),
    tx.select().from(schema.worker),
    tx.select().from(schema.payRate),
    tx
      .select()
      .from(schema.shift)
      .where(and(gte(schema.shift.startsAt, from), lt(schema.shift.startsAt, to), ne(schema.shift.status, "cancelled"))),
    tx.select().from(schema.workerCheck),
    tx.select().from(schema.qualification),
    tx.select().from(schema.workerQualification),
    tx
      .select()
      .from(schema.leaveRequest)
      .where(
        and(
          inArray(schema.leaveRequest.status, ["requested", "approved"]),
          lte(schema.leaveRequest.startsOn, addDays(weekStart, 7)),
          gte(schema.leaveRequest.endsOn, addDays(weekStart, -7 * HISTORY_WEEKS)),
        ),
      ),
    tx.select().from(schema.workerUnavailability),
  ]);
  const assigned = shifts
    .map((s) => (s.id === assume?.shiftId ? { ...s, workerId: assume.workerId } : s))
    .filter((s) => s.workerId);
  const ids = assigned.map((s) => s.id);
  const [breaks, requirements] = ids.length
    ? await Promise.all([
        tx.select().from(schema.shiftBreak).where(inArray(schema.shiftBreak.shiftId, ids)),
        tx.select().from(schema.shiftRequirement).where(inArray(schema.shiftRequirement.shiftId, ids)),
      ])
    : [[], []];
  const qualificationName = new Map(qualifications.map((q) => [q.id, q.name]));

  return {
    // The last day of the week, so 17-week averages end with the week being checked.
    asOf: addDays(weekStart, 6),
    leave: leave.map((l) => ({
      workerId: l.workerId,
      kind: l.kind,
      status: l.status as "requested" | "approved",
      startsOn: l.startsOn,
      endsOn: l.endsOn,
    })),
    settings: { requireEnhancedDbs: organisation?.requiresEnhancedDbs ?? false, paysTravelTime: organisation?.paysTravelTime ?? false },
    workers: workers.map((w) => ({
      id: w.id,
      name: w.fullName,
      dateOfBirth: w.dateOfBirth,
      optedOutOf48HourLimit: w.optedOutOf48HourLimit,
      apprenticeRateApplies: w.apprenticeRateApplies,
      checks: checks
        .filter((c) => c.workerId === w.id)
        .map((c) => ({ kind: c.kind, checkedOn: c.checkedOn, expiresOn: c.expiresOn ?? undefined, dbsLevel: c.dbsLevel ?? undefined })),
      qualifications: held
        .filter((h) => h.workerId === w.id)
        .map((h) => ({
          id: h.qualificationId,
          name: qualificationName.get(h.qualificationId) ?? "Training",
          achievedOn: h.achievedOn ?? undefined,
          expiresOn: h.expiresOn ?? undefined,
        })),
      unavailable: unavailable.filter((u) => u.workerId === w.id).map((u) => ({ weekday: u.weekday, from: u.startsAt, to: u.endsAt })),
      // The note explaining why stays out of the rota check.
      adjustments: { maxShiftHours: w.adjustments.maxShiftHours, earliestStart: w.adjustments.earliestStart, latestFinish: w.adjustments.latestFinish },
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
      travelMinutesBefore: s.travelMinutes,
      requiredQualifications: requirements
        .filter((r) => r.shiftId === s.id)
        .map((r) => ({ id: r.qualificationId, name: qualificationName.get(r.qualificationId) ?? "Training" })),
    })),
  };
};

/** Today's date in the UK. */
export const todayInUk = () => londonParts(Date.now()).date;
