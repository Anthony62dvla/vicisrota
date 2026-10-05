"use server";

import { schema, withOrganisation } from "@vicisrota/db";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireManager } from "@/lib/business";
import { db } from "@/lib/db";
import { billingOf, staffCount } from "@/lib/plan";
import { log } from "@/lib/log";
import { requestId } from "@/lib/request";
import { checkoutUrl, portalUrl, stripeConfigured } from "@/lib/stripe";

export type FormState = { error?: string; ok?: string };

/** Sends the manager to Stripe to pay for the band their team fits, monthly or yearly. */
export async function choosePlan(_: FormState, form: FormData): Promise<FormState> {
  const { user, organisationId } = await requireManager();
  if (!stripeConfigured()) return { error: "Online payment is not switched on yet." };
  const interval = form.get("interval") === "year" ? "year" : "month";
  const [org, staff] = await Promise.all([billingOf(organisationId), staffCount(organisationId)]);
  if (org.subscriptionStatus && org.subscriptionStatus !== "canceled" && org.subscriptionStatus !== "incomplete_expired") {
    return { error: "You already have a plan. Use “Change card, see bills or cancel” to manage it." };
  }
  let url: string | null;
  try {
    url = await checkoutUrl({ organisationId, email: user.email, customerId: org.stripeCustomerId, staff, interval, charity: org.charityApproved });
  } catch (error) {
    await log("error", "stripe.checkout_failed", { organisationId, error: String(error) });
    return { error: `Stripe could not be reached, so nothing has been charged. Please try again in a minute. Reference ${await requestId()}.` };
  }
  if (!url) return { error: "There is nothing to pay for: your team fits the free plan, or is large enough that we agree a price with you." };
  redirect(url);
}

/** Stripe's own page for changing card, seeing bills or cancelling. */
export async function manageBilling(): Promise<void> {
  const { organisationId } = await requireManager();
  const org = await billingOf(organisationId);
  if (!stripeConfigured() || !org.stripeCustomerId) redirect("/billing");
  let url: string;
  try {
    url = await portalUrl(org.stripeCustomerId);
  } catch (error) {
    await log("error", "stripe.portal_failed", { organisationId, error: String(error) });
    redirect("/billing?stripe=down");
  }
  redirect(url);
}

/** Asks for the charity price. VicisRota checks the number before turning it on. */
export async function askCharityPrice(_: FormState, form: FormData): Promise<FormState> {
  const { user, organisationId } = await requireManager();
  const number = String(form.get("number") ?? "").trim().toUpperCase();
  if (!/^[A-Z0-9-]{4,12}$/.test(number)) return { error: "Enter your registered charity number, or your company number if you are a CIC." };
  await db.update(schema.organisation).set({ charityNumber: number, charityApproved: false }).where(eq(schema.organisation.id, organisationId));
  const reference = await requestId();
  await withOrganisation(db, organisationId, (tx) =>
    tx.insert(schema.auditEvent).values({ organisationId, actorUserId: user.id, requestId: reference, action: "update", entity: "charity_price", entityId: organisationId, data: { number } }),
  );
  revalidatePath("/billing");
  return { ok: "Thank you. We will check the number and turn on half price, usually within two working days." };
}
