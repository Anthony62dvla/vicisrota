"use server";

import { addDays, londonDateTime, londonParts } from "@vicisrota/compliance";
import { schema, withOrganisation } from "@vicisrota/db";
import { and, eq, inArray, lt } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireManager } from "@/lib/business";
import { db } from "@/lib/db";
import { requestId } from "@/lib/request";

const TIME = /^\d{2}:\d{2}$/;
const MINUTE = 60_000;

export type FormState = { error?: string; ok?: string };

/** Confirms worked shifts exactly as they were on the rota. */
export async function confirmAsRostered(_: FormState, form: FormData): Promise<FormState> {
  const { user, organisationId } = await requireManager();
  const ids = [...new Set(form.getAll("shiftId").map(String))];
  if (!ids.length) return { error: "There are no shifts to confirm." };

  const count = await withOrganisation(db, organisationId, async (tx) => {
    const shifts = await tx
      .select()
      .from(schema.shift)
      .where(and(inArray(schema.shift.id, ids), eq(schema.shift.status, "published"), lt(schema.shift.startsAt, new Date())));
    if (!shifts.length) return 0;
    const breaks = await tx.select().from(schema.shiftBreak).where(inArray(schema.shiftBreak.shiftId, shifts.map((s) => s.id)));
    const now = new Date();
    const rows = await tx
      .insert(schema.timeEntry)
      .values(
        shifts.map((s) => ({
          organisationId,
          workerId: s.workerId!,
          shiftId: s.id,
          startsAt: s.startsAt,
          endsAt: s.endsAt,
          breakMinutes: Math.round(
            breaks.filter((b) => b.shiftId === s.id).reduce((sum, b) => sum + (b.endsAt.getTime() - b.startsAt.getTime()), 0) / MINUTE,
          ),
          approvedByUserId: user.id,
          approvedAt: now,
        })),
      )
      .onConflictDoNothing({ target: schema.timeEntry.shiftId })
      .returning({ id: schema.timeEntry.id, shiftId: schema.timeEntry.shiftId });
    if (rows.length) {
      await tx.insert(schema.auditEvent).values({
        organisationId,
        actorUserId: user.id,
        requestId: await requestId(),
        action: "approve",
        entity: "time_entry",
        data: { asRostered: true, shiftIds: rows.map((r) => r.shiftId) },
      });
    }
    return rows.length;
  });
  revalidatePath("/timesheets");
  return count ? { ok: `${count} shift${count === 1 ? "" : "s"} confirmed as rostered.` } : { error: "Those shifts were already confirmed." };
}

/** Records the hours actually worked when they differ from the rota. */
export async function saveActualHours(_: FormState, form: FormData): Promise<FormState> {
  const { user, organisationId } = await requireManager();
  const shiftId = String(form.get("shiftId") ?? "");
  const start = String(form.get("start") ?? "");
  const end = String(form.get("end") ?? "");
  const breakMinutes = Number(form.get("breakMinutes") ?? 0);
  const note = String(form.get("note") ?? "").trim() || null;
  if (!TIME.test(start) || !TIME.test(end)) return { error: "Enter the actual start and finish times." };
  if (!(Number.isInteger(breakMinutes) && breakMinutes >= 0 && breakMinutes <= 240)) return { error: "Enter a break between 0 and 240 minutes." };

  const result = await withOrganisation(db, organisationId, async (tx): Promise<FormState> => {
    const [shift] = await tx.select().from(schema.shift).where(and(eq(schema.shift.id, shiftId), eq(schema.shift.status, "published")));
    if (!shift?.workerId) return { error: "That shift could not be found." };
    const date = londonParts(shift.startsAt.getTime()).date;
    const startsAt = londonDateTime(date, start);
    // A finish at or before the start means they worked past midnight.
    let endsAt = londonDateTime(date, end);
    if (endsAt <= startsAt) endsAt = londonDateTime(addDays(date, 1), end);
    if (breakMinutes * MINUTE >= endsAt - startsAt) return { error: "The break is longer than the time worked." };
    if (startsAt > Date.now()) return { error: "Hours can only be confirmed once the shift has started." };

    const values = {
      startsAt: new Date(startsAt),
      endsAt: new Date(endsAt),
      breakMinutes,
      note,
      approvedByUserId: user.id,
      approvedAt: new Date(),
    };
    const [row] = await tx
      .insert(schema.timeEntry)
      .values({ organisationId, workerId: shift.workerId, shiftId, ...values })
      .onConflictDoUpdate({ target: schema.timeEntry.shiftId, set: values })
      .returning({ id: schema.timeEntry.id });
    await tx.insert(schema.auditEvent).values({
      organisationId,
      actorUserId: user.id,
      requestId: await requestId(),
      action: "approve",
      entity: "time_entry",
      entityId: row!.id,
      data: { shiftId, start, end, breakMinutes, rostered: { start: shift.startsAt.toISOString(), end: shift.endsAt.toISOString() } },
    });
    return { ok: "Hours saved." };
  });
  revalidatePath("/timesheets");
  return result;
}

export async function undoConfirmation(form: FormData) {
  const { user, organisationId } = await requireManager();
  const id = String(form.get("entryId") ?? "");
  await withOrganisation(db, organisationId, async (tx) => {
    const rows = await tx.delete(schema.timeEntry).where(eq(schema.timeEntry.id, id)).returning();
    if (!rows.length) return;
    await tx.insert(schema.auditEvent).values({
      organisationId,
      actorUserId: user.id,
      requestId: await requestId(),
      action: "delete",
      entity: "time_entry",
      entityId: id,
      data: { shiftId: rows[0]!.shiftId, startsAt: rows[0]!.startsAt.toISOString(), endsAt: rows[0]!.endsAt.toISOString() },
    });
  });
  revalidatePath("/timesheets");
}
