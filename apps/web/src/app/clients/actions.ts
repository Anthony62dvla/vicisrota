"use server";

import { schema, withOrganisation } from "@vicisrota/db";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireManager } from "@/lib/business";
import { db } from "@/lib/db";
import { requestId } from "@/lib/request";

const POSTCODE = /^[A-Z]{1,2}\d[A-Z\d]? ?\d[A-Z]{2}$/i;

export type FormState = { error?: string; ok?: string };

export async function addClient(_: FormState, form: FormData): Promise<FormState> {
  const { user, organisationId } = await requireManager();
  const name = String(form.get("name") ?? "").trim();
  const postcode = String(form.get("postcode") ?? "").trim().toUpperCase() || null;
  const visitNotes = String(form.get("visitNotes") ?? "").trim() || null;
  if (!name) return { error: "Enter the person's name." };
  if (postcode && !POSTCODE.test(postcode)) return { error: "Enter a UK postcode, for example CF10 1AA, or leave it empty." };

  await withOrganisation(db, organisationId, async (tx) => {
    const [row] = await tx.insert(schema.client).values({ organisationId, name, postcode, visitNotes }).returning({ id: schema.client.id });
    await tx.insert(schema.auditEvent).values({
      organisationId,
      actorUserId: user.id,
      requestId: await requestId(),
      action: "create",
      entity: "client",
      entityId: row!.id,
      // Names and notes are personal data, so only the fact of the change is logged.
      data: { hasPostcode: Boolean(postcode), hasNotes: Boolean(visitNotes) },
    });
  });
  revalidatePath("/clients");
  return { ok: `${name} has been added.` };
}

export async function setClientActive(form: FormData) {
  const { user, organisationId } = await requireManager();
  const id = String(form.get("id") ?? "");
  const active = form.get("active") === "true";
  await withOrganisation(db, organisationId, async (tx) => {
    const rows = await tx.update(schema.client).set({ active }).where(eq(schema.client.id, id)).returning({ id: schema.client.id });
    if (!rows.length) return;
    await tx.insert(schema.auditEvent).values({
      organisationId,
      actorUserId: user.id,
      requestId: await requestId(),
      action: active ? "reactivate" : "deactivate",
      entity: "client",
      entityId: id,
    });
  });
  revalidatePath("/clients");
}

export async function setPaysTravelTime(form: FormData) {
  const { user, organisationId } = await requireManager();
  const paysTravelTime = form.get("paysTravelTime") === "true";
  await withOrganisation(db, organisationId, async (tx) => {
    await tx.update(schema.organisation).set({ paysTravelTime }).where(eq(schema.organisation.id, organisationId));
    await tx.insert(schema.auditEvent).values({
      organisationId,
      actorUserId: user.id,
      requestId: await requestId(),
      action: "update",
      entity: "organisation",
      entityId: organisationId,
      data: { paysTravelTime },
    });
  });
  revalidatePath("/clients");
}
