import { schema, type Transaction } from "@vicisrota/db";
import { and, eq } from "drizzle-orm";

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Reads a "can't work" time from a form. A whole day is from 00:00 to 24:00. */
export const parseSlot = (form: FormData): { weekday: number; startsAt: string; endsAt: string } | { error: string } => {
  const weekday = Number(form.get("weekday"));
  if (!(Number.isInteger(weekday) && weekday >= 1 && weekday <= 7)) return { error: "Choose a day." };
  if (form.get("allDay") === "on") return { weekday, startsAt: "00:00", endsAt: "24:00" };
  const startsAt = String(form.get("from") ?? "");
  // An end of 00:00 means until midnight.
  const to = String(form.get("to") ?? "");
  const endsAt = to === "00:00" ? "24:00" : to;
  if (!TIME.test(startsAt) || !(TIME.test(endsAt) || endsAt === "24:00")) return { error: "Enter a from and to time, or tick all day." };
  if (endsAt <= startsAt) return { error: "The to time must be after the from time. For a time past midnight, add the next day separately." };
  return { weekday, startsAt, endsAt };
};

/** Adds a "can't work" time and records who did it. Runs inside withOrganisation. */
export const addUnavailable = async (
  tx: Transaction,
  a: { organisationId: string; workerId: string; actorUserId: string; requestId: string | null; slot: { weekday: number; startsAt: string; endsAt: string } },
) => {
  const [row] = await tx.insert(schema.workerUnavailability).values({ organisationId: a.organisationId, workerId: a.workerId, ...a.slot }).returning({ id: schema.workerUnavailability.id });
  await tx.insert(schema.auditEvent).values({
    organisationId: a.organisationId,
    actorUserId: a.actorUserId,
    requestId: a.requestId,
    action: "add_unavailable",
    entity: "worker",
    entityId: a.workerId,
    data: { id: row!.id, ...a.slot },
  });
};

/** Removes one of a person's "can't work" times. Only matches that person's own row. */
export const removeUnavailable = async (
  tx: Transaction,
  a: { organisationId: string; workerId: string; actorUserId: string; requestId: string | null; id: string },
) => {
  const [gone] = await tx
    .delete(schema.workerUnavailability)
    .where(and(eq(schema.workerUnavailability.id, a.id), eq(schema.workerUnavailability.workerId, a.workerId)))
    .returning();
  if (!gone) return;
  await tx.insert(schema.auditEvent).values({
    organisationId: a.organisationId,
    actorUserId: a.actorUserId,
    requestId: a.requestId,
    action: "remove_unavailable",
    entity: "worker",
    entityId: a.workerId,
    data: { id: gone.id, weekday: gone.weekday, startsAt: gone.startsAt, endsAt: gone.endsAt },
  });
};
