"use server";

import { schema, withOrganisation } from "@vicisrota/db";
import { and, eq, isNull } from "drizzle-orm";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { hashInviteToken } from "@/lib/invite";
import { log } from "@/lib/log";
import { requestId } from "@/lib/request";
import { findOpenInvitation } from "./invite";

export type JoinState = { error?: string };

export async function acceptInvitation(_: JoinState, form: FormData): Promise<JoinState> {
  const user = await requireUser();
  const token = String(form.get("token") ?? "");
  const open = await findOpenInvitation(token);
  if (!open) return { error: "This link has expired or has already been used. Ask your manager for a new one." };
  const { invitation } = open;

  const error = await withOrganisation(db, invitation.organisationId, async (tx) => {
    const [existing] = await tx
      .select({ role: schema.membership.role })
      .from(schema.membership)
      .where(and(eq(schema.membership.organisationId, invitation.organisationId), eq(schema.membership.userId, user.id)));
    if (existing) return "You already belong to this business with this login.";
    // Claim the invitation first so the same link cannot be used twice at once.
    const claimed = await tx
      .update(schema.invitation)
      .set({ acceptedAt: new Date(), acceptedByUserId: user.id })
      .where(and(eq(schema.invitation.tokenHash, hashInviteToken(token)), isNull(schema.invitation.acceptedAt), isNull(schema.invitation.revokedAt)))
      .returning({ id: schema.invitation.id });
    if (!claimed.length) return "This link has already been used. Ask your manager for a new one.";
    const linked = await tx
      .update(schema.worker)
      .set({ userId: user.id })
      .where(and(eq(schema.worker.id, invitation.workerId), isNull(schema.worker.userId)))
      .returning({ id: schema.worker.id });
    if (!linked.length) throw new Error("Staff record already has a login");
    await tx.insert(schema.membership).values({ organisationId: invitation.organisationId, userId: user.id, role: "worker" });
    await tx.insert(schema.auditEvent).values({
      organisationId: invitation.organisationId,
      actorUserId: user.id,
      requestId: await requestId(),
      action: "accept_invite",
      entity: "worker",
      entityId: invitation.workerId,
      data: { invitationId: invitation.id },
    });
    return null;
  });
  if (error) return { error };
  await log("info", "invitation accepted", { organisationId: invitation.organisationId, workerId: invitation.workerId });
  redirect("/me");
}
