/**
 * VicisRota's prices and what a business can do on its plan.
 *
 * Every business gets its first FREE_STAFF people free, with every feature, for as long as it likes.
 * Beyond that it pays per extra person. Not paying only ever pauses planning (publishing rotas and
 * adding staff): nothing to do with safety, pay or people's own shifts is ever switched off.
 */
export const PRICING = {
  /** People every business has free, whatever its size. */
  freeStaff: 5,
  /** Paying yearly costs this many months. */
  yearlyMonths: 10,
  /** Registered charities and community interest companies pay this share of the price. */
  charityPercent: 50,
  /** Days of unlimited staff for a new business, with no card. */
  trialDays: 30,
  /** Days a failed payment is retried before planning pauses. */
  graceDays: 14,
} as const;

/**
 * Fixed monthly prices by team size. A team pays for the smallest band it fits in, and moves band
 * automatically from its next bill when it grows or shrinks.
 */
export const BANDS = [
  { upTo: 15, monthPence: 2900 },
  { upTo: 30, monthPence: 4900 },
  { upTo: 60, monthPence: 8900 },
  { upTo: 100, monthPence: 13900 },
] as const;

export type Band = (typeof BANDS)[number];
export type BillingInterval = "month" | "year";

/** The band a team of this size pays for: "free" up to five people, "large" past the biggest band. */
export const bandFor = (staff: number): Band | "free" | "large" =>
  staff <= PRICING.freeStaff ? "free" : (BANDS.find((b) => staff <= b.upTo) ?? "large");

/** A band's price, before VAT. */
export const bandPrice = (band: Band, { interval = "month", charity = false }: { interval?: BillingInterval; charity?: boolean } = {}) =>
  band.monthPence * (interval === "year" ? PRICING.yearlyMonths : 1) * (charity ? PRICING.charityPercent / 100 : 1);

export type Subscription = {
  /** Stripe's status for the subscription. */
  status: string;
  /** When payments started failing, if they are. */
  pastDueSince: Date | null;
};

export type PlanState =
  | { kind: "free"; canPlan: true }
  | { kind: "trial"; canPlan: true; daysLeft: number }
  | { kind: "paid"; canPlan: true }
  | { kind: "late"; canPlan: true; daysLeft: number }
  | { kind: "paused"; canPlan: false; why: "trial-ended" | "payment-failed" | "cancelled" };

const DAY = 86_400_000;

/** Where a business stands today, and whether it can publish rotas and add staff. */
export const planState = ({
  now,
  staff,
  trialEndsAt,
  subscription,
}: {
  now: Date;
  staff: number;
  trialEndsAt: Date | null;
  subscription: Subscription | null;
}): PlanState => {
  const status = subscription?.status;
  if (status === "active" || status === "trialing") return { kind: "paid", canPlan: true };
  if (status === "past_due" || status === "unpaid") {
    const since = subscription!.pastDueSince ?? now;
    const left = Math.ceil((since.getTime() + PRICING.graceDays * DAY - now.getTime()) / DAY);
    if (left > 0) return { kind: "late", canPlan: true, daysLeft: left };
    if (staff > PRICING.freeStaff) return { kind: "paused", canPlan: false, why: "payment-failed" };
  }
  if (staff <= PRICING.freeStaff) return { kind: "free", canPlan: true };
  if (trialEndsAt && trialEndsAt.getTime() > now.getTime()) {
    return { kind: "trial", canPlan: true, daysLeft: Math.ceil((trialEndsAt.getTime() - now.getTime()) / DAY) };
  }
  return { kind: "paused", canPlan: false, why: status === "canceled" ? "cancelled" : "trial-ended" };
};

/** Whether a business could add one more person and still plan. */
export const canAddPerson = (input: Parameters<typeof planState>[0]) => planState({ ...input, staff: input.staff + 1 }).canPlan;
