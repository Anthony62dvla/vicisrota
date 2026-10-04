import type { Shift } from "@vicisrota/compliance";
import { schema, type Transaction } from "@vicisrota/db";
import { and, asc, gte, lt } from "drizzle-orm";
import { periodBounds } from "./payroll";

/** Confirmed hours as pieces of work, with the unpaid break placed at the start (only its length matters). */
export const entryAsShift = (e: typeof schema.timeEntry.$inferSelect): Shift => ({
  id: e.id,
  workerId: e.workerId,
  start: e.startsAt.toISOString(),
  end: e.endsAt.toISOString(),
  breaks: e.breakMinutes ? [{ start: e.startsAt.toISOString(), end: new Date(e.startsAt.getTime() + e.breakMinutes * 60_000).toISOString() }] : [],
});

/** Confirmed hours that started between `from` and `to` (whole UK dates). Runs inside withOrganisation. */
export const loadConfirmedHours = (tx: Transaction, from: string, to: string) => {
  const { start, end } = periodBounds(from, to);
  return tx
    .select()
    .from(schema.timeEntry)
    .where(and(gte(schema.timeEntry.startsAt, start), lt(schema.timeEntry.startsAt, end)))
    .orderBy(asc(schema.timeEntry.startsAt));
};
