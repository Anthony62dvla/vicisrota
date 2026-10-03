import { loneWorkStatus, type LoneWorkStatus } from "@vicisrota/compliance";
import { schema, type Transaction } from "@vicisrota/db";
import { and, asc, eq, gt, inArray, lt } from "drizzle-orm";

export type LoneShift = {
  shift: typeof schema.shift.$inferSelect;
  workerName: string | null;
  clientName: string | null;
  postcode: string | null;
  checks: (typeof schema.loneWorkCheck.$inferSelect)[];
  status: LoneWorkStatus;
};

/** Published lone working shifts overlapping [from, to], with their check-ins and current status. */
export const loadLoneShifts = async (tx: Transaction, opts: { from: Date; to: Date; now: number; workerId?: string }): Promise<LoneShift[]> => {
  const rows = await tx
    .select({ shift: schema.shift, workerName: schema.worker.fullName, clientName: schema.client.name, postcode: schema.client.postcode })
    .from(schema.shift)
    .leftJoin(schema.worker, eq(schema.shift.workerId, schema.worker.id))
    .leftJoin(schema.client, eq(schema.shift.clientId, schema.client.id))
    .where(
      and(
        eq(schema.shift.loneWorking, true),
        eq(schema.shift.status, "published"),
        lt(schema.shift.startsAt, opts.to),
        gt(schema.shift.endsAt, opts.from),
        opts.workerId ? eq(schema.shift.workerId, opts.workerId) : undefined,
      ),
    )
    .orderBy(asc(schema.shift.startsAt));
  const ids = rows.map((r) => r.shift.id);
  const checks = ids.length
    ? await tx.select().from(schema.loneWorkCheck).where(inArray(schema.loneWorkCheck.shiftId, ids)).orderBy(asc(schema.loneWorkCheck.createdAt))
    : [];
  return rows
    .filter((r) => r.shift.workerId)
    .map((r) => {
      const mine = checks.filter((c) => c.shiftId === r.shift.id);
      return {
        ...r,
        checks: mine,
        status: loneWorkStatus({
          start: r.shift.startsAt.getTime(),
          end: r.shift.endsAt.getTime(),
          intervalMinutes: r.shift.checkInMinutes,
          checks: mine.map((c) => ({ kind: c.kind, at: c.createdAt.getTime() })),
          now: opts.now,
        }),
      };
    });
};

/** Help first, then missed check-ins, then everyone else. */
export const URGENCY = { help: 0, overdue: 1, ok: 2, not_started: 3, finished: 4 } as const;
