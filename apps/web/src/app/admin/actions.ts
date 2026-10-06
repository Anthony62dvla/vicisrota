"use server";

import { schema } from "@vicisrota/db";
import { and, eq, isNull, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { applyPack } from "@/lib/apply-pack";
import { db } from "@/lib/db";
import { hashInviteToken, newInviteToken } from "@/lib/invite";
import { log } from "@/lib/log";
import { OWNER_INVITE_DAYS } from "@/lib/owner-invite";
import { requestId } from "@/lib/request";
import { packById } from "@/lib/sector-packs";
import { appUrl } from "@/lib/sms";
import { applyCharityPrice, stripeConfigured } from "@/lib/stripe";
import { recordPlatformAction, requireSuperadmin } from "@/lib/superadmin";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type OnboardState = { error?: string; ok?: string; link?: string; values?: Record<string, string> };

/** A fresh owner link for a business, replacing any open one. Runs in the caller's transaction. */
const issueOwnerLink = async (
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  organisationId: string,
  ownerName: string,
  email: string,
  createdByUserId: string,
  replaceUserId: string | null = null,
) => {
  await tx
    .update(schema.ownerInvitation)
    .set({ revokedAt: new Date() })
    .where(and(eq(schema.ownerInvitation.organisationId, organisationId), isNull(schema.ownerInvitation.acceptedAt), isNull(schema.ownerInvitation.revokedAt)));
  const token = newInviteToken();
  await tx.insert(schema.ownerInvitation).values({
    organisationId,
    ownerName,
    email,
    tokenHash: hashInviteToken(token),
    expiresAt: new Date(Date.now() + OWNER_INVITE_DAYS * 86_400_000),
    createdByUserId,
    replaceUserId,
  });
  return appUrl(`/welcome/${token}`) || `/welcome/${token}`;
};

/** Sets up a business for a new customer and gives back a link for its owner to take it over. */
export async function onboardBusiness(_: OnboardState, form: FormData): Promise<OnboardState> {
  const admin = await requireSuperadmin();
  const name = String(form.get("name") ?? "").trim();
  const pack = packById(String(form.get("kind") ?? ""));
  const ownerName = String(form.get("ownerName") ?? "").trim();
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const values = { name, kind: pack?.id ?? "", ownerName, email };
  if (!name || name.length > 120) return { error: "Enter the business name (up to 120 characters).", values };
  if (!pack) return { error: "Choose the type of business.", values };
  const { sector } = pack;
  if (!ownerName) return { error: "Enter the owner's name.", values };
  if (!EMAIL.test(email)) return { error: "Enter the owner's email address.", values };

  const reference = await requestId();
  const { organisationId, link } = await db.transaction(async (tx) => {
    const [org] = await tx.insert(schema.organisation).values({ name, sector, kind: pack.id, requiresEnhancedDbs: pack.enhancedDbs }).returning({ id: schema.organisation.id });
    const id = org!.id;
    await tx.execute(sql`select set_config('app.organisation_id', ${id}, true)`);
    await applyPack(tx, id, pack);
    await tx.insert(schema.auditEvent).values({
      organisationId: id,
      actorUserId: admin.id,
      requestId: reference,
      action: "create",
      entity: "organisation",
      entityId: id,
      data: { name, sector, kind: pack.id, by: "VicisRota onboarding" },
    });
    return { organisationId: id, link: await issueOwnerLink(tx, id, ownerName, email, admin.id) };
  });
  // The trail keeps who the link was for, never the link itself, because it signs someone in as owner.
  await recordPlatformAction(admin.id, "create_business", organisationId, { name, sector, ownerEmail: email });
  await log("info", "business onboarded", { organisationId, sector });
  revalidatePath("/admin");
  return { ok: `${name} is set up. Send this link to ${ownerName} at ${email}. It works for ${OWNER_INVITE_DAYS} days.`, link };
}

/** A new owner link for a business whose first link expired or went astray. */
export async function newOwnerLink(_: OnboardState, form: FormData): Promise<OnboardState> {
  const admin = await requireSuperadmin();
  const organisationId = String(form.get("organisationId") ?? "");
  const [last] = await db
    .select()
    .from(schema.ownerInvitation)
    .where(eq(schema.ownerInvitation.organisationId, organisationId))
    .orderBy(sql`${schema.ownerInvitation.createdAt} desc`)
    .limit(1);
  if (!last) return { error: "This business was not set up by onboarding, so it has no owner link." };
  if (last.acceptedAt) return { error: "The owner has already joined." };
  const link = await db.transaction((tx) => issueOwnerLink(tx, organisationId, last.ownerName, last.email, admin.id, last.replaceUserId));
  await recordPlatformAction(admin.id, "new_owner_link", organisationId, { ownerEmail: last.email });
  revalidatePath("/admin");
  return { ok: `New link for ${last.ownerName} (${last.email}). The old one no longer works.`, link };
}

/**
 * Hands an existing business to a new owner or manager: a link like onboarding's. If asked, the superadmin's own
 * access to the business ends when the new person takes it over, so the business is theirs alone.
 */
export async function handOverBusiness(_: OnboardState, form: FormData): Promise<OnboardState> {
  const admin = await requireSuperadmin();
  const organisationId = String(form.get("organisationId") ?? "");
  const ownerName = String(form.get("ownerName") ?? "").trim();
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const removeMe = form.get("removeMe") === "on";
  const values = { ownerName, email };
  if (!ownerName) return { error: "Enter the new manager's name.", values };
  if (!EMAIL.test(email)) return { error: "Enter the new manager's email address.", values };
  const [org] = await db.select({ name: schema.organisation.name }).from(schema.organisation).where(eq(schema.organisation.id, organisationId));
  if (!org) return { error: "That business could not be found.", values };
  const [mine] = await db
    .select({ role: schema.membership.role })
    .from(schema.membership)
    .where(and(eq(schema.membership.organisationId, organisationId), eq(schema.membership.userId, admin.id)));
  const replace = removeMe && mine ? admin.id : null;
  const link = await db.transaction((tx) => issueOwnerLink(tx, organisationId, ownerName, email, admin.id, replace));
  await recordPlatformAction(admin.id, "hand_over_business", organisationId, { ownerEmail: email, removeOwnAccess: Boolean(replace) });
  revalidatePath("/admin");
  const after = replace ? " When they take it over, your own access to it ends." : "";
  return { ok: `Send this link to ${ownerName} at ${email} so they can take over ${org.name}. It works for ${OWNER_INVITE_DAYS} days.${after}`, link };
}

/** Turns on the charity price for a business once its charity or CIC number has been checked. */
export async function approveCharity(_: OnboardState, form: FormData): Promise<OnboardState> {
  const admin = await requireSuperadmin();
  const organisationId = String(form.get("organisationId") ?? "");
  const [org] = await db
    .select({ number: schema.organisation.charityNumber, subscriptionId: schema.organisation.stripeSubscriptionId })
    .from(schema.organisation)
    .where(eq(schema.organisation.id, organisationId));
  if (!org?.number) return { error: "This business has not given a charity or CIC number." };
  await db.update(schema.organisation).set({ charityApproved: true }).where(eq(schema.organisation.id, organisationId));
  if (org.subscriptionId && stripeConfigured()) await applyCharityPrice(org.subscriptionId);
  await recordPlatformAction(admin.id, "approve_charity", organisationId, { number: org.number });
  revalidatePath("/admin");
  return { ok: "Charity price turned on." };
}
