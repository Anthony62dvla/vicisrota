import { addDays, attendance, londonDateTime, londonParts, type AttendanceState } from "@vicisrota/compliance";
import { schema, type Transaction } from "@vicisrota/db";
import { and, asc, eq, gt, inArray, isNotNull, lt, lte, gte } from "drizzle-orm";
import { clockSummaries } from "./clock";

export type AttendanceRow = {
  shift: typeof schema.shift.$inferSelect;
  workerName: string;
  roleName: string | null;
  place: string | null;
  state: AttendanceState;
  minutesLate: number;
  clockedIn: number | null;
  clockedOut: number | null;
};

/**
 * Everyone rostered on published shifts overlapping [from, to], with whether they have clocked in.
 * Approved leave or sickness on the day the shift starts explains an empty clock. Runs inside withOrganisation.
 */
export const loadAttendance = async (tx: Transaction, opts: { from: Date; to: Date; now: number }): Promise<AttendanceRow[]> => {
  const rows = await tx
    .select({
      shift: schema.shift,
      workerName: schema.worker.fullName,
      roleName: schema.jobRole.name,
      locationName: schema.location.name,
      clientName: schema.client.name,
    })
    .from(schema.shift)
    .innerJoin(schema.worker, eq(schema.shift.workerId, schema.worker.id))
    .leftJoin(schema.jobRole, eq(schema.shift.roleId, schema.jobRole.id))
    .leftJoin(schema.location, eq(schema.shift.locationId, schema.location.id))
    .leftJoin(schema.client, eq(schema.shift.clientId, schema.client.id))
    .where(and(eq(schema.shift.status, "published"), isNotNull(schema.shift.workerId), lt(schema.shift.startsAt, opts.to), gt(schema.shift.endsAt, opts.from)))
    .orderBy(asc(schema.shift.startsAt));
  if (!rows.length) return [];

  const dayOf = (d: Date) => londonParts(d.getTime()).date;
  const days = rows.map((r) => dayOf(r.shift.startsAt)).sort();
  const leave = await tx
    .select({ workerId: schema.leaveRequest.workerId, startsOn: schema.leaveRequest.startsOn, endsOn: schema.leaveRequest.endsOn })
    .from(schema.leaveRequest)
    .where(
      and(
        eq(schema.leaveRequest.status, "approved"),
        inArray(schema.leaveRequest.workerId, [...new Set(rows.map((r) => r.shift.workerId!))]),
        lte(schema.leaveRequest.startsOn, days.at(-1)!),
        gte(schema.leaveRequest.endsOn, days[0]!),
      ),
    );
  const clocks = new Map((await clockSummaries(tx, rows.map((r) => r.shift), opts.now)).map((c) => [c.shift.id, c.summary]));

  return rows.map((r) => {
    const day = dayOf(r.shift.startsAt);
    const onLeave = leave.some((l) => l.workerId === r.shift.workerId && l.startsOn <= day && l.endsOn >= day);
    const summary = clocks.get(r.shift.id)!;
    const { state, minutesLate } = attendance(summary, { start: r.shift.startsAt.getTime(), end: r.shift.endsAt.getTime() }, opts.now, onLeave);
    return {
      shift: r.shift,
      workerName: r.workerName,
      roleName: r.roleName,
      place: r.clientName ?? r.locationName,
      state,
      minutesLate,
      clockedIn: summary.clockedIn,
      clockedOut: summary.clockedOut,
    };
  });
};

/** Today in the UK, plus anything from last night still running. */
export const todayWindow = (now: number) => {
  const today = londonParts(now).date;
  return { from: new Date(londonDateTime(today, "00:00")), to: new Date(londonDateTime(addDays(today, 1), "00:00")) };
};

/** Who needs attention first. */
export const ATTENDANCE_ORDER: Record<AttendanceState, number> = {
  late: 0,
  missed: 1,
  starting: 2,
  in: 3,
  on_break: 4,
  upcoming: 5,
  on_leave: 6,
  finished: 7,
};
