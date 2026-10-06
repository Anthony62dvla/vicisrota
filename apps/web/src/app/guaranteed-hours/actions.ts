"use server";

import { schema, withOrganisation } from "@vicisrota/db";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireManager } from "@/lib/business";
import { db } from "@/lib/db";
import { todayInUk } from "@/lib/rota";
import { requestId } from "@/lib/request";

export type FormState = { error?: string; ok?: string };

const hoursFrom = (v: FormDataEntryValue | null) => {
  const raw = String(v ?? "").trim();
  if (raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 && n <= 99 && Math.round(n * 2) === n * 2 ? n : NaN;
};

/** The hours a week someone's contract guarantees. Blank means not recorded. */
export async function saveContractedHours(_: FormState, form: FormData): Promise<FormState> {
  const { user, organisationId } = await requireManager();
  const workerId = String(form.get("workerId") ?? "");
  const hours = hoursFrom(form.get("contractedHours"));
  if (Number.isNaN(hours)) return { error: "Enter the hours in half hours, from 0 to 99. Use 0 for a zero-hours contract." };
  return withOrganisation(db, organisationId, async (tx): Promise<FormState> => {
    const rows = await tx.update(schema.worker).set({ contractedHours: hours }).where(eq(schema.worker.id, workerId)).returning({ name: schema.worker.fullName });
    if (!rows.length) return { error: "That person could not be found." };
    await tx.insert(schema.auditEvent).values({ organisationId, actorUserId: user.id, requestId: await requestId(), action: "update", entity: "contracted_hours", entityId: workerId, data: { hours } });
    revalidatePath("/guaranteed-hours");
    return { ok: `Saved for ${rows[0]!.name}.` };
  });
}

/** Records an offer of guaranteed hours, made in writing outside VicisRota or face to face. */
export async function recordOffer(_: FormState, form: FormData): Promise<FormState> {
  const { user, organisationId } = await requireManager();
  const workerId = String(form.get("workerId") ?? "");
  const hours = hoursFrom(form.get("weeklyHours"));
  if (hours === null || Number.isNaN(hours) || hours === 0) return { error: "Enter the hours offered, in half hours." };
  return withOrganisation(db, organisationId, async (tx): Promise<FormState> => {
    const [w] = await tx.select({ name: schema.worker.fullName }).from(schema.worker).where(eq(schema.worker.id, workerId));
    if (!w) return { error: "That person could not be found." };
    const [row] = await tx.insert(schema.guaranteedHoursOffer).values({ organisationId, workerId, weeklyHours: hours, offeredOn: todayInUk(), recordedByUserId: user.id }).returning({ id: schema.guaranteedHoursOffer.id });
    await tx.insert(schema.auditEvent).values({ organisationId, actorUserId: user.id, requestId: await requestId(), action: "create", entity: "guaranteed_hours_offer", entityId: row!.id, data: { workerId, hours } });
    revalidatePath("/guaranteed-hours");
    return { ok: `Offer of ${hours} hours a week recorded for ${w.name}.` };
  });
}

/** Their answer. Accepting changes the hours their contract guarantees. */
export async function answerOffer(form: FormData) {
  const { user, organisationId } = await requireManager();
  const id = String(form.get("offerId") ?? "");
  const answer = String(form.get("answer") ?? "");
  if (answer !== "accepted" && answer !== "declined") return;
  await withOrganisation(db, organisationId, async (tx) => {
    const [offer] = await tx
      .update(schema.guaranteedHoursOffer)
      .set({ status: answer, answeredOn: todayInUk() })
      .where(and(eq(schema.guaranteedHoursOffer.id, id), eq(schema.guaranteedHoursOffer.status, "offered")))
      .returning();
    if (!offer) return;
    if (answer === "accepted") await tx.update(schema.worker).set({ contractedHours: offer.weeklyHours }).where(eq(schema.worker.id, offer.workerId));
    await tx.insert(schema.auditEvent).values({ organisationId, actorUserId: user.id, requestId: await requestId(), action: "update", entity: "guaranteed_hours_offer", entityId: id, data: { answer } });
  });
  revalidatePath("/guaranteed-hours");
}
