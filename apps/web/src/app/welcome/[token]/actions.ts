"use server";

import { schema } from "@vicisrota/db";
import { and, eq, isNull, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { hashInviteToken } from "@/lib/invite";
import { log } from "@/lib/log";
import { findOpenOwnerInvitation } from "@/lib/owner-invite";
import { requestId } from "@/lib/request";

export type WelcomeState = { error?: string };

/** The new customer's owner takes over the business VicisRota set up for them. */
export async function acceptOwnerInvitation(_: WelcomeState, form: FormData): Promise<WelcomeState> {
  const user = await requireUser();
  const token = String(form.get("token") ?? "");
  const open = await findOpenOwnerInvitation(token);
  if (!open) return { error: "This link has expired or has already been used. Ask VicisRota for a new one." };
  const { invitation } = open;
  const reference = await requestId();

  const error = await db.transaction(async (tx) => {
    // Claim the link first so it cannot be used twice at once.
    const claimed = await tx
      .update(schema.ownerInvitation)
      .set({ acceptedAt: new Date(), acceptedByUserId: user.id })
      .where(and(eq(schema.ownerInvitation.tokenHash, hashInviteToken(token)), isNull(schema.ownerInvitation.acceptedAt), isNull(schema.ownerInvitation.revokedAt)))
      .returning({ id: schema.ownerInvitation.id });
    if (!claimed.length) return "This link has already been used. Ask VicisRota for a new one.";
    const [existing] = await tx
      .select({ role: schema.membership.role })
      .from(schema.membership)
      .where(and(eq(schema.membership.organisationId, invitation.organisationId), eq(schema.membership.userId, user.id)));
    if (existing) await tx.update(schema.membership).set({ role: "owner" }).where(and(eq(schema.membership.organisationId, invitation.organisationId), eq(schema.membership.userId, user.id)));
    else await tx.insert(schema.membership).values({ organisationId: invitation.organisationId, userId: user.id, role: "owner" });
    await tx.execute(sql`select set_config('app.organisation_id', ${invitation.organisationId}, true)`);
    await tx.insert(schema.auditEvent).values({
      organisationId: invitation.organisationId,
      actorUserId: user.id,
      requestId: reference,
      action: "accept_owner_invite",
      entity: "organisation",
      entityId: invitation.organisationId,
      data: { invitationId: invitation.id },
    });
    await tx.insert(schema.platformAudit).values({
      actorUserId: user.id,
      action: "owner_joined",
      organisationId: invitation.organisationId,
      data: { invitedEmail: invitation.email, signedInAs: user.email, requestId: reference },
    });
    return null;
  });
  if (error) return { error };
  await log("info", "owner joined", { organisationId: invitation.organisationId });
  redirect("/dashboard");
}
