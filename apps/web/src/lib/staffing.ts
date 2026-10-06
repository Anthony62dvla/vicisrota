import { staffingGaps, type StaffingGap, type StaffingLevel } from "@vicisrota/compliance";
import { schema, type Transaction } from "@vicisrota/db";
import { and, gte, lt, ne } from "drizzle-orm";
import { weekBounds } from "./rota";

export const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;

/** The business's safe staffing levels, in the form the check uses, with workplace and role names. */
export const loadStaffingLevels = async (tx: Transaction): Promise<StaffingLevel[]> => {
  const [levels, locations, roles] = await Promise.all([
    tx.select().from(schema.staffingLevel),
    tx.select({ id: schema.location.id, name: schema.location.name }).from(schema.location),
    tx.select({ id: schema.jobRole.id, name: schema.jobRole.name }).from(schema.jobRole),
  ]);
  const place = new Map(locations.map((l) => [l.id, l.name]));
  const role = new Map(roles.map((r) => [r.id, r.name]));
  return levels.map((l) => ({
    id: l.id,
    place: l.locationId ? (place.get(l.locationId) ?? "This workplace") : "Your business",
    locationId: l.locationId,
    roleId: l.roleId,
    roleName: l.roleId ? (role.get(l.roleId) ?? null) : null,
    weekdays: l.weekdays,
    from: l.startsAt,
    to: l.endsAt,
    minPeople: l.minPeople,
    strict: l.strict,
  }));
};

/**
 * Every gap in one week's rota against the safe staffing levels. Draft and published shifts count;
 * cancelled and open shifts do not. Runs inside withOrganisation.
 */
export const loadStaffingGaps = async (tx: Transaction, weekStart: string): Promise<StaffingGap[]> => {
  const levels = await loadStaffingLevels(tx);
  if (levels.length === 0) return [];
  const { from, to } = weekBounds(weekStart);
  // A night level on the Sunday runs into the next Monday, so shifts up to a day after the week count too.
  const [shifts, workerRoles] = await Promise.all([
    tx
      .select()
      .from(schema.shift)
      .where(and(gte(schema.shift.endsAt, from), lt(schema.shift.startsAt, new Date(to.getTime() + 86_400_000)), ne(schema.shift.status, "cancelled"))),
    tx.select().from(schema.workerRole),
  ]);
  const roles = new Map<string, string[]>();
  for (const r of workerRoles) roles.set(r.workerId, [...(roles.get(r.workerId) ?? []), r.roleId]);
  return staffingGaps({
    levels,
    weekStart,
    workerRoles: roles,
    shifts: shifts.map((s) => ({ id: s.id, workerId: s.workerId, locationId: s.locationId, roleId: s.roleId, start: s.startsAt.toISOString(), end: s.endsAt.toISOString() })),
  });
};
