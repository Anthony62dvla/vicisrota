"use server";

import { schema, withOrganisation } from "@vicisrota/db";
import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireManager } from "@/lib/business";
import { TASK_MAX } from "@/lib/checklists";
import { db } from "@/lib/db";
import { requestId } from "@/lib/request";

/** values: what was typed, sent back on an error so the form is not cleared. */
export type FormState = { error?: string; ok?: string; values?: Record<string, string> };

/** Sets up a checklist: a name, one task per line, and which shifts it is for. */
export async function saveChecklist(_: FormState, form: FormData): Promise<FormState> {
  const { user, organisationId } = await requireManager();
  const name = String(form.get("name") ?? "").trim();
  const raw = String(form.get("items") ?? "");
  const roleId = String(form.get("roleId") ?? "") || null;
  const locationId = String(form.get("locationId") ?? "") || null;
  const values = { name, items: raw, roleId: roleId ?? "", locationId: locationId ?? "" };
  const items = raw
    .split("\n")
    .map((l) => l.replace(/^\s*[-*•]\s*/, "").trim())
    .filter(Boolean);
  if (!name || name.length > 80) return { error: "Give the checklist a short name (up to 80 characters).", values };
  if (!items.length) return { error: "Write at least one task, one per line.", values };
  if (items.length > 40) return { error: "Keep a checklist to 40 tasks or fewer. Split a longer one into two.", values };
  if (items.some((i) => i.length > TASK_MAX)) return { error: `Keep each task to ${TASK_MAX} characters or fewer.`, values };
  const saved = await withOrganisation(db, organisationId, async (tx) => {
    if (roleId && !(await tx.select({ id: schema.jobRole.id }).from(schema.jobRole).where(eq(schema.jobRole.id, roleId))).length) return false;
    if (locationId && !(await tx.select({ id: schema.location.id }).from(schema.location).where(eq(schema.location.id, locationId))).length) return false;
    const [row] = await tx.insert(schema.checklistTemplate).values({ organisationId, name, items, roleId, locationId }).returning({ id: schema.checklistTemplate.id });
    await tx.insert(schema.auditEvent).values({ organisationId, actorUserId: user.id, requestId: await requestId(), action: "create", entity: "checklist", entityId: row!.id, data: { name, tasks: items.length } });
    return true;
  });
  if (!saved) return { error: "Choose the role and workplace again.", values };
  revalidatePath("/checklists");
  return { ok: `${name} saved. It shows on matching shifts from now on.` };
}

/** Stops a checklist showing on new shifts. Ticks already made are kept. */
export async function archiveChecklist(form: FormData) {
  const { user, organisationId } = await requireManager();
  const id = String(form.get("id") ?? "");
  await withOrganisation(db, organisationId, async (tx) => {
    const [row] = await tx
      .update(schema.checklistTemplate)
      .set({ archivedAt: new Date() })
      .where(and(eq(schema.checklistTemplate.id, id), isNull(schema.checklistTemplate.archivedAt)))
      .returning({ id: schema.checklistTemplate.id });
    if (row) await tx.insert(schema.auditEvent).values({ organisationId, actorUserId: user.id, requestId: await requestId(), action: "archive", entity: "checklist", entityId: id });
  });
  revalidatePath("/checklists");
}
