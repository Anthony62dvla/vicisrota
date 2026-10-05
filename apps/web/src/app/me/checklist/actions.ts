"use server";

import { schema, withOrganisation } from "@vicisrota/db";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/business";
import { appliesTo, HANDOVER_MAX } from "@/lib/checklists";
import { db } from "@/lib/db";

export type FormState = { error?: string; ok?: string; values?: Record<string, string> };

/** Ticks or unticks one task on the person's own shift. */
export async function setTick(shiftId: string, templateId: string, item: number, done: boolean): Promise<{ ok: boolean }> {
  const { organisationId, worker } = await requireStaff();
  const ok = await withOrganisation(db, organisationId, async (tx) => {
    const [shift] = await tx.select().from(schema.shift).where(and(eq(schema.shift.id, shiftId), eq(schema.shift.workerId, worker.id)));
    const [template] = await tx.select().from(schema.checklistTemplate).where(eq(schema.checklistTemplate.id, templateId));
    if (!shift || !template || !appliesTo(template, shift) || !Number.isInteger(item) || !template.items[item]) return false;
    const where = and(eq(schema.checklistTick.shiftId, shiftId), eq(schema.checklistTick.templateId, templateId), eq(schema.checklistTick.item, item));
    if (done) {
      await tx
        .insert(schema.checklistTick)
        .values({ organisationId, shiftId, templateId, item, task: template.items[item]!, workerId: worker.id })
        .onConflictDoNothing();
    } else {
      await tx.delete(schema.checklistTick).where(where);
    }
    return true;
  });
  revalidatePath("/me/checklist");
  return { ok };
}

/** Leaves a note for the next people working at the same workplace. */
export async function leaveHandover(_: FormState, form: FormData): Promise<FormState> {
  const { organisationId, worker } = await requireStaff();
  const shiftId = String(form.get("shiftId") ?? "");
  const body = String(form.get("body") ?? "").trim();
  if (!body) return { error: "Write your handover note first." };
  if (body.length > HANDOVER_MAX) return { error: `Keep the note to ${HANDOVER_MAX.toLocaleString("en-GB")} characters or fewer.`, values: { body } };
  const ok = await withOrganisation(db, organisationId, async (tx) => {
    const [shift] = await tx.select().from(schema.shift).where(and(eq(schema.shift.id, shiftId), eq(schema.shift.workerId, worker.id)));
    if (!shift) return false;
    await tx.insert(schema.handover).values({ organisationId, shiftId, workerId: worker.id, locationId: shift.locationId, body });
    return true;
  });
  if (!ok) return { error: "That shift could not be found.", values: { body } };
  revalidatePath("/me/checklist");
  return { ok: "Handover saved. The next people on shift here will see it." };
}
