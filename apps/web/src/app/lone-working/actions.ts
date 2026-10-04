"use server";

import { schema, withOrganisation } from "@vicisrota/db";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireManager } from "@/lib/business";
import { db } from "@/lib/db";
import { requestId } from "@/lib/request";
import { normaliseUkMobile } from "@vicisrota/messaging";

export type FormState = { error?: string; ok?: string };

/** A manager records that a call for help, or a missed check-in, has been dealt with. */
export async function markDealtWith(_: FormState, form: FormData): Promise<FormState> {
  const { user, organisationId } = await requireManager();
  const shiftId = String(form.get("shiftId") ?? "");
  const note = String(form.get("note") ?? "").trim();
  if (!note) return { error: "Write what you did, for example who you spoke to." };
  if (note.length > 2000) return { error: "That is too long to save. Please shorten it." };
  const result = await withOrganisation(db, organisationId, async (tx): Promise<FormState> => {
    const [shift] = await tx
      .select({ id: schema.shift.id })
      .from(schema.shift)
      .where(and(eq(schema.shift.id, shiftId), eq(schema.shift.organisationId, organisationId), eq(schema.shift.loneWorking, true)));
    if (!shift) return { error: "That shift could not be found." };
    await tx.insert(schema.loneWorkCheck).values({ organisationId, shiftId, actorUserId: user.id, actorName: user.name, kind: "resolved", note });
    await tx.insert(schema.auditEvent).values({ organisationId, actorUserId: user.id, requestId: await requestId(), action: "lone_resolved", entity: "shift", entityId: shiftId });
    return { ok: "Recorded." };
  });
  revalidatePath("/lone-working");
  return result;
}

export async function addAlertContact(_: FormState, form: FormData): Promise<FormState> {
  const { user, organisationId } = await requireManager();
  const name = String(form.get("name") ?? "").trim();
  const phone = normaliseUkMobile(String(form.get("phone") ?? ""));
  if (!name) return { error: "Enter their name." };
  if (!phone) return { error: "Enter a UK mobile number, for example 07700 900123." };
  if (form.get("consent") !== "on") return { error: "Check they have agreed to receive these texts first." };
  await withOrganisation(db, organisationId, async (tx) => {
    const [row] = await tx.insert(schema.alertContact).values({ organisationId, name, phone }).returning({ id: schema.alertContact.id });
    await tx.insert(schema.auditEvent).values({ organisationId, actorUserId: user.id, requestId: await requestId(), action: "create", entity: "alert_contact", entityId: row!.id, data: { name } });
  });
  revalidatePath("/lone-working");
  return { ok: `${name} will now get alert texts.` };
}

export async function removeAlertContact(form: FormData) {
  const { user, organisationId } = await requireManager();
  const id = String(form.get("id") ?? "");
  await withOrganisation(db, organisationId, async (tx) => {
    await tx.update(schema.alertContact).set({ active: false }).where(eq(schema.alertContact.id, id));
    await tx.insert(schema.auditEvent).values({ organisationId, actorUserId: user.id, requestId: await requestId(), action: "remove", entity: "alert_contact", entityId: id });
  });
  revalidatePath("/lone-working");
}
