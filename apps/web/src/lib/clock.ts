import { clockSummary, type ClockSummary } from "@vicisrota/compliance";
import { schema, type Transaction } from "@vicisrota/db";
import { and, asc, eq, gt, inArray, lt } from "drizzle-orm";

/** Staff can clock in up to an hour early, and clock out up to four hours after the rostered end. */
export const CLOCK_IN_EARLY_MS = 60 * 60_000;
export const CLOCK_OUT_LATE_MS = 4 * 3_600_000;

export type ClockedShift = { shift: typeof schema.shift.$inferSelect; summary: ClockSummary };

/** Clock summaries for the given shifts. */
export const clockSummaries = async (tx: Transaction, shifts: (typeof schema.shift.$inferSelect)[], now: number): Promise<ClockedShift[]> => {
  const ids = shifts.map((s) => s.id);
  const events = ids.length ? await tx.select().from(schema.clockEvent).where(inArray(schema.clockEvent.shiftId, ids)).orderBy(asc(schema.clockEvent.at)) : [];
  return shifts.map((shift) => ({
    shift,
    summary: clockSummary(
      events.filter((e) => e.shiftId === shift.id).map((e) => ({ kind: e.kind, at: e.at.getTime() })),
      { start: shift.startsAt.getTime(), end: shift.endsAt.getTime() },
      now,
    ),
  }));
};

/** The person's published shifts they can clock in or out of right now. */
export const clockableShifts = async (tx: Transaction, workerId: string, now: number) =>
  clockSummaries(
    tx,
    await tx
      .select()
      .from(schema.shift)
      .where(
        and(
          eq(schema.shift.workerId, workerId),
          eq(schema.shift.status, "published"),
          lt(schema.shift.startsAt, new Date(now + CLOCK_IN_EARLY_MS)),
          gt(schema.shift.endsAt, new Date(now - CLOCK_OUT_LATE_MS)),
        ),
      )
      .orderBy(asc(schema.shift.startsAt)),
    now,
  );
