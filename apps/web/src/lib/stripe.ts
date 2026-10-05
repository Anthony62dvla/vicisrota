import { BANDS, bandFor, bandPrice, PRICING, type Band, type BillingInterval } from "@vicisrota/compliance";
import { schema } from "@vicisrota/db";
import { and, eq, inArray, isNotNull } from "drizzle-orm";
import Stripe from "stripe";
import { db } from "./db";
import { log } from "./log";
import { staffCount } from "./plan";
import { appUrl } from "./sms";

/** Payments are switched on once STRIPE_SECRET_KEY is set. Until then the billing page says so. */
export const stripeConfigured = () => Boolean(process.env.STRIPE_SECRET_KEY);

let client: Stripe | undefined;
export const stripe = () => (client ??= new Stripe(process.env.STRIPE_SECRET_KEY!));

const CHARITY_COUPON = "vicisrota-charity";

/** The coupon that halves the price for charities and CICs, made the first time it is needed. */
const charityCoupon = async () => {
  try {
    return (await stripe().coupons.retrieve(CHARITY_COUPON)).id;
  } catch {
    return (
      await stripe().coupons.create({ id: CHARITY_COUPON, percent_off: 100 - PRICING.charityPercent, duration: "forever", name: "Charity and CIC price" })
    ).id;
  }
};

const PRODUCT = "vicisrota-plan";

/** The Stripe price for a band, made the first time it is needed and found by its lookup key after that. */
const priceId = async (band: Band, interval: BillingInterval) => {
  const key = `vicisrota-${band.upTo}-${interval}-${bandPrice(band, { interval })}`;
  const found = await stripe().prices.list({ lookup_keys: [key], limit: 1 });
  if (found.data[0]) return found.data[0].id;
  try {
    await stripe().products.retrieve(PRODUCT);
  } catch {
    await stripe().products.create({ id: PRODUCT, name: "VicisRota" });
  }
  const price = await stripe().prices.create({
    product: PRODUCT,
    currency: "gbp",
    unit_amount: bandPrice(band, { interval }),
    recurring: { interval },
    lookup_key: key,
    nickname: `Up to ${band.upTo} people, ${interval === "year" ? "yearly" : "monthly"}`,
  });
  return price.id;
};

/** The band Stripe charges for a subscription, worked out from its price's lookup key. */
const bandOfPrice = (lookupKey: string | null | undefined) => {
  const upTo = Number(lookupKey?.split("-")[1]);
  return BANDS.find((b) => b.upTo === upTo) ?? null;
};

/** A Stripe Checkout page for a new subscription in the band the team fits. Null when there is nothing to pay for. */
export const checkoutUrl = async ({
  organisationId,
  email,
  customerId,
  staff,
  interval,
  charity,
}: {
  organisationId: string;
  email: string;
  customerId: string | null;
  staff: number;
  interval: BillingInterval;
  charity: boolean;
}) => {
  const band = bandFor(staff);
  if (typeof band === "string") return null;
  const session = await stripe().checkout.sessions.create({
    mode: "subscription",
    client_reference_id: organisationId,
    ...(customerId ? { customer: customerId } : { customer_email: email }),
    line_items: [{ price: await priceId(band, interval), quantity: 1 }],
    ...(charity ? { discounts: [{ coupon: await charityCoupon() }] } : {}),
    subscription_data: { metadata: { organisationId } },
    success_url: appUrl("/billing?done=1"),
    cancel_url: appUrl("/billing"),
  });
  return session.url;
};

/** Stripe's own page for changing card, seeing invoices or cancelling. */
export const portalUrl = async (customerId: string) =>
  (await stripe().billingPortal.sessions.create({ customer: customerId, return_url: appUrl("/billing") })).url;

/** Applies the charity price to a subscription that already exists. */
export const applyCharityPrice = async (subscriptionId: string) =>
  stripe().subscriptions.update(subscriptionId, { discounts: [{ coupon: await charityCoupon() }] });

/** Copies a subscription's state from Stripe onto the business it belongs to. */
export const saveSubscription = async (subscription: Stripe.Subscription, organisationId?: string | null) => {
  const customer = typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;
  const orgId = organisationId ?? subscription.metadata?.organisationId;
  const where = orgId ? eq(schema.organisation.id, orgId) : eq(schema.organisation.stripeCustomerId, customer);
  const [org] = await db.select({ id: schema.organisation.id, pastDueSince: schema.organisation.pastDueSince }).from(schema.organisation).where(where);
  if (!org) {
    await log("warn", "stripe.unknown_business", { subscription: subscription.id });
    return;
  }
  const item = subscription.items.data[0];
  const failing = subscription.status === "past_due" || subscription.status === "unpaid";
  await db
    .update(schema.organisation)
    .set({
      stripeCustomerId: customer,
      stripeSubscriptionId: subscription.id,
      subscriptionStatus: subscription.status,
      billingInterval: item?.price.recurring?.interval === "year" ? "year" : "month",
      planBand: bandOfPrice(item?.price.lookup_key)?.upTo ?? null,
      pastDueSince: failing ? (org.pastDueSince ?? new Date()) : null,
    })
    .where(eq(schema.organisation.id, org.id));
};

/**
 * Moves each paying team to the band that fits it now. The new price starts from the next bill, never
 * part-way through one. Teams past the biggest band stay where they are until a price is agreed.
 */
export const syncBands = async () => {
  if (!stripeConfigured()) return 0;
  const paying = await db
    .select({
      id: schema.organisation.id,
      subscriptionId: schema.organisation.stripeSubscriptionId,
      planBand: schema.organisation.planBand,
      interval: schema.organisation.billingInterval,
    })
    .from(schema.organisation)
    .where(and(isNotNull(schema.organisation.stripeSubscriptionId), inArray(schema.organisation.subscriptionStatus, ["active", "trialing", "past_due"])));
  let changed = 0;
  for (const org of paying) {
    const fits = bandFor(await staffCount(org.id));
    // Down to five or fewer: keep the smallest band rather than cancelling for them; they can cancel themselves.
    const band = fits === "free" ? BANDS[0] : fits === "large" ? null : fits;
    if (!band || band.upTo === org.planBand) continue;
    try {
      const subscription = await stripe().subscriptions.retrieve(org.subscriptionId!);
      const item = subscription.items.data[0];
      if (!item) continue;
      await stripe().subscriptionItems.update(item.id, { price: await priceId(band, org.interval ?? "month"), proration_behavior: "none" });
      await db.update(schema.organisation).set({ planBand: band.upTo }).where(eq(schema.organisation.id, org.id));
      changed++;
    } catch (error) {
      await log("error", "stripe.band_change_failed", { organisationId: org.id, error: String(error) });
    }
  }
  return changed;
};
