"use server";

import { schema, withOrganisation } from "@vicisrota/db";
import { and, eq, isNotNull, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireManager } from "@/lib/business";
import { db } from "@/lib/db";
import { notifyWorkers } from "@/lib/notify";
import { requestId } from "@/lib/request";

/** values: what was typed, sent back on an error so the form is not cleared. */
export type FormState = { error?: string; ok?: string; values?: Record<string, string> };

export async function postAnnouncement(_: FormState, form: FormData): Promise<FormState> {
  const { user, organisationId } = await requireManager();
  const title = String(form.get("title") ?? "").trim();
  const body = String(form.get("body") ?? "").trim();
  const needsConfirmation = form.get("needsConfirmation") === "on";
  const values = { title, body, needsConfirmation: needsConfirmation ? "on" : "" };
  if (!title || title.length > 120) return { error: "Give it a short title (up to 120 characters).", values };
  if (!body || body.length > 5000) return { error: "Write the message (up to 5,000 characters).", values };
  const { id, staff } = await withOrganisation(db, organisationId, async (tx) => {
    const [row] = await tx
      .insert(schema.announcement)
      .values({ organisationId, title, body, needsConfirmation, createdByUserId: user.id })
      .returning({ id: schema.announcement.id });
    await tx.insert(schema.auditEvent).values({
      organisationId,
      actorUserId: user.id,
      requestId: await requestId(),
      action: "create",
      entity: "announcement",
      entityId: row!.id,
      data: { title, needsConfirmation },
    });
    const staff = await tx.select({ id: schema.worker.id }).from(schema.worker).where(and(isNotNull(schema.worker.userId), isNull(schema.worker.leftOn)));
    return { id: row!.id, staff };
  });
  // App notifications only: they are free, and announcements are never urgent enough to text.
  await notifyWorkers(
    organisationId,
    staff.map((w) => ({ workerId: w.id, purpose: "announcement", title, body: body.slice(0, 200), url: "/me", dedupeKey: `announcement:${id}` })),
  );
  revalidatePath("/announcements");
  return { ok: needsConfirmation ? "Posted. Staff will be asked to confirm they have read it." : "Posted. Staff will see it on their page." };
}

/** Hides an announcement from staff pages. It and its confirmations are kept. */
export async function archiveAnnouncement(form: FormData) {
  const { user, organisationId } = await requireManager();
  const id = String(form.get("id") ?? "");
  await withOrganisation(db, organisationId, async (tx) => {
    const [row] = await tx
      .update(schema.announcement)
      .set({ archivedAt: new Date() })
      .where(and(eq(schema.announcement.id, id), isNull(schema.announcement.archivedAt)))
      .returning({ id: schema.announcement.id });
    if (row)
      await tx.insert(schema.auditEvent).values({
        organisationId,
        actorUserId: user.id,
        requestId: await requestId(),
        action: "archive",
        entity: "announcement",
        entityId: id,
      });
  });
  revalidatePath("/announcements");
}
