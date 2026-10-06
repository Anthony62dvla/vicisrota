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
  /** Check the week as if these shifts were given to these people, e.g. before approving a swap. */
  assume?: Assume,
): Promise<Context> => (await loadWeekChecks(tx, organisationId, weekStart, assume)).context;

/** One or more shifts to check as if they belonged to someone else. */
export type Assume = { shiftId: string; workerId: string } | { shiftId: string; workerId: string }[];

/** A shift as the compliance engine sees it, before anyone is given it. */
export type CheckShift = Omit<Context["shifts"][number], "workerId">;

/**
 * The compliance context for a week, plus its open shifts in the same form, so the rota can try each
 * open shift against each person ("Who can take this?") without going back to the database.
 */
export const loadWeekChecks = async (
  tx: Transaction,
  organisationId: string,
  weekStart: string,
  assume?: Assume,
): Promise<{ context: Context; open: CheckShift[] }> => {
  const { from } = weekBounds(addDays(weekStart, -7 * HISTORY_WEEKS));
  const { to } = weekBounds(weekStart);

  const [[organisation], workers, rates, shifts, checks, qualifications, held, leave, unavailable, roles, workerRoles] = await Promise.all([
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
    tx.select({ id: schema.jobRole.id, name: schema.jobRole.name }).from(schema.jobRole),
    tx.select().from(schema.workerRole),
  ]);
  const roleById = new Map(roles.map((r) => [r.id, r]));
  const assumed = new Map((Array.isArray(assume) ? assume : assume ? [assume] : []).map((a) => [a.shiftId, a.workerId]));
  const assigned = shifts
    .map((s) => (assumed.has(s.id) ? { ...s, workerId: assumed.get(s.id)! } : s))
    .filter((s) => s.workerId);
  const unassigned = shifts.filter((s) => !s.workerId && !assumed.has(s.id));
  const ids = [...assigned, ...unassigned].map((s) => s.id);
  const [breaks, requirements] = ids.length
    ? await Promise.all([
        tx.select().from(schema.shiftBreak).where(inArray(schema.shiftBreak.shiftId, ids)),
        tx.select().from(schema.shiftRequirement).where(inArray(schema.shiftRequirement.shiftId, ids)),
      ])
    : [[], []];
  const qualificationName = new Map(qualifications.map((q) => [q.id, q.name]));
  const toCheck = (s: (typeof shifts)[number]): CheckShift => ({
    id: s.id,
    start: s.startsAt.toISOString(),
    end: s.endsAt.toISOString(),
    breaks: breaks.filter((b) => b.shiftId === s.id).map((b) => ({ start: b.startsAt.toISOString(), end: b.endsAt.toISOString() })),
    travelMinutesBefore: s.travelMinutes,
    sleepIn: s.kind === "sleep_in" ? { awakeMinutes: 0 } : undefined,
    role: s.roleId ? roleById.get(s.roleId) : undefined,
    requiredQualifications: requirements
      .filter((r) => r.shiftId === s.id)
      .map((r) => ({ id: r.qualificationId, name: qualificationName.get(r.qualificationId) ?? "Training" })),
  });

  const context: Context = {
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
      roles: workerRoles.filter((r) => r.workerId === w.id).map((r) => r.roleId),
    })),
    payRates: rates.map((r) => ({ workerId: r.workerId, hourlyPence: r.hourlyPence, effectiveFrom: r.effectiveFrom })),
    shifts: assigned.map((s) => ({ ...toCheck(s), workerId: s.workerId! })),
  };
  return { context, open: unassigned.map(toCheck) };
};

/** Today's date in the UK. */
export const todayInUk = () => londonParts(Date.now()).date;
