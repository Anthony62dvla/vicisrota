"use server";

import { schema, withOrganisation } from "@vicisrota/db";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { LATE_ALERT_CHOICES } from "@/lib/attendance-choices";
import { requireManager } from "@/lib/business";
import { db } from "@/lib/db";
import { requestId } from "@/lib/request";

export type FormState = { error?: string; ok?: string };

export async function setLateAlerts(_: FormState, form: FormData): Promise<FormState> {
  const { user, organisationId } = await requireManager();
  const raw = String(form.get("minutes") ?? "");
  const minutes = raw === "off" ? null : Number(raw);
  if (minutes !== null && !LATE_ALERT_CHOICES.includes(minutes)) return { error: "Choose when to send a text, or turn texts off." };
  await withOrganisation(db, organisationId, async (tx) => {
    await tx.update(schema.organisation).set({ lateAlertMinutes: minutes }).where(eq(schema.organisation.id, organisationId));
    await tx.insert(schema.auditEvent).values({ organisationId, actorUserId: user.id, requestId: await requestId(), action: "update", entity: "late_alerts", entityId: organisationId, data: { minutes } });
  });
  revalidatePath("/attendance");
  return { ok: minutes === null ? "Late texts are off." : `Saved. Your alert contacts will get a text when someone has not clocked in ${minutes} minutes after their shift starts.` };
}
