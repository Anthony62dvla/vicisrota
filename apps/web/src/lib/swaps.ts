import { schema, type Transaction } from "@vicisrota/db";
import { and, eq, inArray, or } from "drizzle-orm";

const timeFmt = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const dayFmt = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", weekday: "long", day: "numeric", month: "long" });

/** "Monday 12 October, 09:00 to 17:00", for swap messages. */
export const shiftWhen = (s: { startsAt: Date; endsAt: Date }) => `${dayFmt.format(s.startsAt).replace(",", "")}, ${timeFmt.format(s.startsAt)} to ${timeFmt.format(s.endsAt)}`;

export type SwapRow = {
  swap: typeof schema.shiftSwap.$inferSelect;
  fromShift: typeof schema.shift.$inferSelect;
  toShift: typeof schema.shift.$inferSelect;
  fromName: string;
  toName: string;
};

/** Open swaps with both shifts and both names. Pass a worker to see only theirs. Runs inside withOrganisation. */
export const loadOpenSwaps = async (tx: Transaction, workerId?: string): Promise<SwapRow[]> => {
  const swaps = await tx
    .select()
    .from(schema.shiftSwap)
    .where(
      and(
        inArray(schema.shiftSwap.status, ["asked", "agreed"]),
        workerId ? or(eq(schema.shiftSwap.fromWorkerId, workerId), eq(schema.shiftSwap.toWorkerId, workerId)) : undefined,
      ),
    )
    .orderBy(schema.shiftSwap.createdAt);
  if (!swaps.length) return [];
  const [shifts, workers] = await Promise.all([
    tx.select().from(schema.shift).where(inArray(schema.shift.id, swaps.flatMap((s) => [s.fromShiftId, s.toShiftId]))),
    tx
      .select({ id: schema.worker.id, fullName: schema.worker.fullName })
      .from(schema.worker)
      .where(inArray(schema.worker.id, swaps.flatMap((s) => [s.fromWorkerId, s.toWorkerId]))),
  ]);
  const name = new Map(workers.map((w) => [w.id, w.fullName]));
  return swaps.flatMap((swap) => {
    const fromShift = shifts.find((s) => s.id === swap.fromShiftId);
    const toShift = shifts.find((s) => s.id === swap.toShiftId);
    return fromShift && toShift ? [{ swap, fromShift, toShift, fromName: name.get(swap.fromWorkerId) ?? "", toName: name.get(swap.toWorkerId) ?? "" }] : [];
  });
};

/** Whether both shifts are still as they were when the swap was asked for: published, not started, same people. */
export const swapStillValid = (row: Pick<SwapRow, "swap" | "fromShift" | "toShift">, now = new Date()) =>
  row.fromShift.status === "published" &&
  row.toShift.status === "published" &&
  row.fromShift.workerId === row.swap.fromWorkerId &&
  row.toShift.workerId === row.swap.toWorkerId &&
  row.fromShift.startsAt > now &&
  row.toShift.startsAt > now;
