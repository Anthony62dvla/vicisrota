import { schema, type Transaction } from "@vicisrota/db";
import { desc, isNull } from "drizzle-orm";
import { loadAttendance } from "./attendance";

const MINUTE = 60_000;

/** The roll call in progress, if any. Runs inside withOrganisation. */
export const activeRollCall = async (tx: Transaction) =>
  (await tx.select().from(schema.rollCall).where(isNull(schema.rollCall.endedAt)).orderBy(desc(schema.rollCall.startedAt)).limit(1))[0] ?? null;

/**
 * Who should be on site right now: everyone clocked in, and everyone whose published shift is under way but
 * who has not clocked in (they may be in the building anyway). Care visits to clients' homes are left out,
 * because those people are not on site. One line per person.
 */
export const peopleOnSite = async (tx: Transaction, now: number) => {
  const rows = await loadAttendance(tx, { from: new Date(now - MINUTE), to: new Date(now + MINUTE), now });
  const people = new Map<string, { workerId: string; name: string; expected: "clocked_in" | "not_clocked_in"; place: string | null }>();
  for (const r of rows) {
    if (r.shift.clientId) continue;
    const expected = r.state === "in" || r.state === "on_break" ? "clocked_in" : r.state === "late" || r.state === "starting" ? "not_clocked_in" : null;
    if (!expected) continue;
    const before = people.get(r.shift.workerId!);
    if (before?.expected === "clocked_in") continue;
    people.set(r.shift.workerId!, { workerId: r.shift.workerId!, name: r.workerName, expected, place: r.place });
  }
  return [...people.values()];
};
