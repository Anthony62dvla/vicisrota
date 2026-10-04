"use server";

import { schema, withOrganisation } from "@vicisrota/db";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/business";
import { db } from "@/lib/db";
import { requestId } from "@/lib/request";
import { CONTACT_WAYS, PROFILE_MAX, PROFILE_QUESTIONS, type ContactWay, type WorkProfile } from "@/lib/work-profile";

export type FormState = { error?: string; ok?: string };

export async function saveWorkProfile(_: FormState, form: FormData): Promise<FormState> {
  const { user, organisationId, worker } = await requireStaff();
  const profile: WorkProfile = {};
  for (const q of PROFILE_QUESTIONS) {
    const answer = String(form.get(q.key) ?? "").trim();
    if (answer.length > PROFILE_MAX) return { error: `"${q.label}" is too long. Please keep each answer under ${PROFILE_MAX} characters.` };
    if (answer) profile[q.key] = answer;
  }
  const contact = form.getAll("contact").map(String).filter((w): w is ContactWay => (CONTACT_WAYS as string[]).includes(w));
  if (contact.length) profile.contact = contact;
  if (form.get("avoidCalls") === "on") profile.avoidCalls = true;
  profile.shared = form.get("shared") === "on";
  await withOrganisation(db, organisationId, async (tx) => {
    await tx.update(schema.worker).set({ workProfile: profile }).where(eq(schema.worker.id, worker.id));
    // Only whether it is shared goes in the audit trail, never what the person wrote.
    if (profile.shared !== !!worker.workProfile.shared) {
      await tx.insert(schema.auditEvent).values({
        organisationId,
        actorUserId: user.id,
        requestId: await requestId(),
        action: profile.shared ? "share" : "unshare",
        entity: "work_profile",
        entityId: worker.id,
        data: {},
      });
    }
  });
  revalidatePath("/me/profile");
  return { ok: profile.shared ? "Saved. Your managers can now see this." : "Saved. Only you can see this." };
}
