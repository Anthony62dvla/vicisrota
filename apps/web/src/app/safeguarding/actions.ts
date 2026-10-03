"use server";

import { schema, withOrganisation } from "@vicisrota/db";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireManager } from "@/lib/business";
import { db } from "@/lib/db";
import { requestId } from "@/lib/request";
import { CONCERN_STATUS_LABEL, type ConcernStatus, type FormState } from "@/lib/concern-labels";
import { raiseConcern } from "@/lib/safeguarding";

export async function raiseConcernAsManager(_: FormState, form: FormData): Promise<FormState> {
  const { user, organisationId } = await requireManager();
  const result = await raiseConcern(form, { organisationId, userId: user.id, name: user.name, allowedClientIds: "all" });
  revalidatePath("/safeguarding");
  return result.ok ? { ok: "Concern recorded. It is now in the list above." } : result;
}

/** Adds to a concern's permanent record: a note, a referral, or a change of status. */
export async function recordConcernAction(_: FormState, form: FormData): Promise<FormState> {
  const { user, organisationId } = await requireManager();
  const concernId = String(form.get("concernId") ?? "");
  const note = String(form.get("note") ?? "").trim();
  const referredTo = String(form.get("referredTo") ?? "").trim() || null;
  let status = String(form.get("status") ?? "") as ConcernStatus;
  if (!(status in CONCERN_STATUS_LABEL)) return { error: "Choose a status." };
  if (!note) return { error: "Write what was done or decided." };
  if (note.length > 10_000 || (referredTo?.length ?? 0) > 200) return { error: "That is too long to save. Please shorten it." };

  const result = await withOrganisation(db, organisationId, async (tx): Promise<FormState> => {
    const [concern] = await tx
      .select({ status: schema.safeguardingConcern.status })
      .from(schema.safeguardingConcern)
      .where(and(eq(schema.safeguardingConcern.id, concernId), eq(schema.safeguardingConcern.organisationId, organisationId)));
    if (!concern) return { error: "That concern could not be found." };
    // A referral moves the concern on unless the manager chose a status themselves.
    if (referredTo && status === concern.status && status !== "closed") status = "referred";
    const kind = referredTo ? "referral" : status !== concern.status ? "status" : "note";
    await tx.insert(schema.safeguardingAction).values({ organisationId, concernId, actorUserId: user.id, actorName: user.name, kind, referredTo, note });
    if (status !== concern.status) {
      await tx.update(schema.safeguardingConcern).set({ status }).where(eq(schema.safeguardingConcern.id, concernId));
    }
    await tx.insert(schema.auditEvent).values({
      organisationId,
      actorUserId: user.id,
      requestId: await requestId(),
      action: kind,
      entity: "safeguarding_concern",
      entityId: concernId,
      data: { from: concern.status, to: status },
    });
    return { ok: kind === "referral" ? `Referral to ${referredTo} recorded.` : kind === "status" ? `Marked as ${CONCERN_STATUS_LABEL[status].toLowerCase()}.` : "Note added." };
  });
  revalidatePath("/safeguarding");
  return result;
}
