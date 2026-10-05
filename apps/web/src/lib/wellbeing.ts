import { CHECK_IN_HOURS, checkInDue } from "@vicisrota/compliance";
import { schema, withOrganisation, type Transaction as Tx } from "@vicisrota/db";
import { and, eq, gte, inArray, lte, ne } from "drizzle-orm";
import { db } from "./db";
import { notifyWorkers } from "./notify";
import { sendPush } from "./push";

/** The answers, in the person's words. No scores are shown to anyone. */
export const ANSWERS = [
  { value: 1, label: "Good" },
  { value: 2, label: "OK" },
  { value: 3, label: "Tiring" },
  { value: 4, label: "Hard" },
  { value: 5, label: "Really hard" },
] as const;
export const answerLabel = (v: number | null) => ANSWERS.find((a) => a.value === v)?.label ?? "Skipped";
export const NOTE_MAX = 1000;

const recentlyEnded = (tx: Tx, now: number, workerIds?: string[]) =>
  tx
    .select({ shift: schema.shift, worker: { id: schema.worker.id, preferences: schema.worker.preferences } })
    .from(schema.shift)
    .innerJoin(schema.worker, eq(schema.shift.workerId, schema.worker.id))
    .where(
      and(
        eq(schema.shift.status, "published"),
        lte(schema.shift.endsAt, new Date(now)),
        gte(schema.shift.endsAt, new Date(now - CHECK_IN_HOURS * 3_600_000)),
        workerIds ? inArray(schema.shift.workerId, workerIds) : undefined,
      ),
    );

/** Shifts the person could check in about now: ended in the last day, matching their choice, not yet answered. */
export const pendingCheckIns = async (tx: Tx, workerId: string, now: number) => {
  const rows = await recentlyEnded(tx, now, [workerId]);
  if (!rows.length) return [];
  const done = await tx
    .select({ shiftId: schema.wellbeingCheckIn.shiftId })
    .from(schema.wellbeingCheckIn)
    .where(eq(schema.wellbeingCheckIn.workerId, workerId));
  return rows
    .filter((r) => !done.some((d) => d.shiftId === r.shift.id))
    .filter((r) => checkInDue(r.worker.preferences.wellbeing ?? {}, { id: r.shift.id, workerId, start: r.shift.startsAt.toISOString(), end: r.shift.endsAt.toISOString() }, now))
    .map((r) => r.shift);
};

/**
 * Sends a gentle app notification after a shift to people who turned check-ins on. Push only, never a
 * text, and only in the first two hours after the shift, so nobody is asked in the middle of the night later.
 */
export const offerCheckIns = async (organisationId: string, businessName: string, now: number) => {
  const { rows, answered } = await withOrganisation(db, organisationId, async (tx) => {
    const rows = await recentlyEnded(tx, now);
    const answered = rows.length
      ? await tx
          .select({ shiftId: schema.wellbeingCheckIn.shiftId })
          .from(schema.wellbeingCheckIn)
          .where(inArray(schema.wellbeingCheckIn.shiftId, rows.map((r) => r.shift.id)))
      : [];
    return { rows, answered };
  });
  const due = rows.filter(
    (r) =>
      now - r.shift.endsAt.getTime() <= 2 * 3_600_000 &&
      !answered.some((a) => a.shiftId === r.shift.id) &&
      checkInDue(r.worker.preferences.wellbeing ?? {}, { id: r.shift.id, workerId: r.worker.id, start: r.shift.startsAt.toISOString(), end: r.shift.endsAt.toISOString() }, now),
  );
  if (!due.length) return 0;
  const { pushed } = await notifyWorkers(
    organisationId,
    due.map((r) => ({
      workerId: r.worker.id,
      purpose: "wellbeing",
      title: `${businessName}: how was your shift?`,
      body: "A quick, private check-in. Skip it if you like.",
      url: "/me/wellbeing",
      dedupeKey: `wellbeing:${r.shift.id}`,
    })),
  );
  return pushed;
};

/** Tells the managers that someone would like a chat. Only that: never their answer or note. */
export const tellManagersAboutChat = async (organisationId: string, personName: string) => {
  const managers = await withOrganisation(db, organisationId, (tx) =>
    tx
      .select({ userId: schema.membership.userId })
      .from(schema.membership)
      .where(and(eq(schema.membership.organisationId, organisationId), ne(schema.membership.role, "worker"))),
  );
  await sendPush(
    managers.map((m) => m.userId),
    { title: `${personName} would like a chat`, body: "They asked after a shift. Open Wellbeing to see when.", url: "/wellbeing", tag: `chat:${personName}` },
  );
};
