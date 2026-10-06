"use server";

import { schema, withOrganisation } from "@vicisrota/db";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireManager } from "@/lib/business";
import { db } from "@/lib/db";
import { requestId } from "@/lib/request";
import { todayInUk } from "@/lib/rota";

export type FormState = { error?: string; ok?: string };

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Records that a duty was reported on the Sponsor Management System, so it stops showing as due. */
export async function markReported(_: FormState, form: FormData): Promise<FormState> {
  const { user, organisationId } = await requireManager();
  const workerId = String(form.get("workerId") ?? "");
  const kind = String(form.get("kind") ?? "");
  const eventDate = String(form.get("eventDate") ?? "");
  const reportedOn = String(form.get("reportedOn") ?? "") || todayInUk();
  const reference = String(form.get("reference") ?? "").trim() || null;
  if (kind !== "absence" && kind !== "left") return { error: "That cannot be marked as reported." };
  if (!DATE.test(eventDate) || !DATE.test(reportedOn)) return { error: "Enter the date you reported it." };
  if (reportedOn > todayInUk()) return { error: "The date reported cannot be in the future." };
  if (reference && reference.length > 60) return { error: "Keep the reference under 60 characters." };
  const result = await withOrganisation(db, organisationId, async (tx): Promise<FormState> => {
    // Foreign keys skip row-level security, so confirm the person belongs to this business.
    const [worker] = await tx.select({ name: schema.worker.fullName }).from(schema.worker).where(eq(schema.worker.id, workerId));
    if (!worker) return { error: "That person could not be found." };
    const [row] = await tx
      .insert(schema.sponsorReport)
      .values({ organisationId, workerId, kind, eventDate, reportedOn, reference, reportedByUserId: user.id })
      .onConflictDoUpdate({ target: [schema.sponsorReport.workerId, schema.sponsorReport.kind, schema.sponsorReport.eventDate], set: { reportedOn, reference, reportedByUserId: user.id } })
      .returning({ id: schema.sponsorReport.id });
    await tx.insert(schema.auditEvent).values({ organisationId, actorUserId: user.id, requestId: await requestId(), action: "create", entity: "sponsor_report", entityId: row!.id, data: { workerId, kind, eventDate, reportedOn, reference: !!reference } });
    return { ok: `Recorded as reported for ${worker.name}.` };
  });
  revalidatePath("/sponsorship");
  return result;
}

export async function undoReported(form: FormData) {
  const { user, organisationId } = await requireManager();
  const id = String(form.get("id") ?? "");
  await withOrganisation(db, organisationId, async (tx) => {
    const [row] = await tx.delete(schema.sponsorReport).where(and(eq(schema.sponsorReport.id, id))).returning();
    if (!row) return;
    await tx.insert(schema.auditEvent).values({ organisationId, actorUserId: user.id, requestId: await requestId(), action: "delete", entity: "sponsor_report", entityId: id, data: { workerId: row.workerId, kind: row.kind, eventDate: row.eventDate } });
  });
  revalidatePath("/sponsorship");
}
