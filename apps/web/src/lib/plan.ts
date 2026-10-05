import { canAddPerson, planState, PRICING, type PlanState } from "@vicisrota/compliance";
import { schema, withOrganisation } from "@vicisrota/db";
import { count, eq, isNull } from "drizzle-orm";
import { db } from "./db";

/** People on the team now: everyone who has not left. This is what the price counts. */
export const staffCount = (organisationId: string) =>
  withOrganisation(db, organisationId, async (tx) => {
    const [row] = await tx.select({ n: count() }).from(schema.worker).where(isNull(schema.worker.leftOn));
    return row?.n ?? 0;
  });

/** The business's billing details. The organisation table is not tenant-scoped. */
export const billingOf = async (organisationId: string) => {
  const [org] = await db
    .select({
      name: schema.organisation.name,
      trialEndsAt: schema.organisation.trialEndsAt,
      charityNumber: schema.organisation.charityNumber,
      charityApproved: schema.organisation.charityApproved,
      stripeCustomerId: schema.organisation.stripeCustomerId,
      stripeSubscriptionId: schema.organisation.stripeSubscriptionId,
      subscriptionStatus: schema.organisation.subscriptionStatus,
      billingInterval: schema.organisation.billingInterval,
      pastDueSince: schema.organisation.pastDueSince,
      planBand: schema.organisation.planBand,
    })
    .from(schema.organisation)
    .where(eq(schema.organisation.id, organisationId));
  return org!;
};

const inputFor = (org: Awaited<ReturnType<typeof billingOf>>, staff: number) => ({
  now: new Date(),
  staff,
  trialEndsAt: org.trialEndsAt,
  subscription: org.subscriptionStatus ? { status: org.subscriptionStatus, pastDueSince: org.pastDueSince } : null,
});

/** Where the business stands, for the billing page and the dashboard. */
export const planFor = async (organisationId: string) => {
  const [org, staff] = await Promise.all([billingOf(organisationId), staffCount(organisationId)]);
  return { org, staff, state: planState(inputFor(org, staff)) };
};

export const PAUSED_MESSAGE =
  "Publishing rotas is paused until the business chooses a plan. Everything to do with safety, pay and people's own shifts still works.";

/** Nothing is ever paused before online payment is switched on, so nobody is stuck without a way to pay. */
const paymentsOn = () => Boolean(process.env.STRIPE_SECRET_KEY);

/** For actions that publish a rota: an error to show when planning is paused, otherwise null. */
export const planningBlocked = async (organisationId: string) =>
  !paymentsOn() || (await planFor(organisationId)).state.canPlan ? null : PAUSED_MESSAGE;

/** For actions that add someone to the team: an error to show when that would go past the free people. */
export const addingBlocked = async (organisationId: string, people = 1) => {
  if (!paymentsOn()) return null;
  const [org, staff] = await Promise.all([billingOf(organisationId), staffCount(organisationId)]);
  // canAddPerson asks about one more person, so count the others as already there.
  return canAddPerson(inputFor(org, staff + people - 1))
    ? null
    : `The free plan covers ${PRICING.freeStaff} people. Choose a plan on the Plan and billing page to add more.`;
};

/** A short line about the plan for the dashboard, or null when there is nothing to say. */
export const planNotice = (state: PlanState): { text: string; urgent: boolean } | null => {
  if (!paymentsOn()) return null;
  switch (state.kind) {
    case "trial":
      return state.daysLeft <= 7
        ? { text: `Your free trial ends in ${state.daysLeft} day${state.daysLeft === 1 ? "" : "s"}. Choose a plan to keep publishing rotas for more than ${PRICING.freeStaff} people.`, urgent: false }
        : null;
    case "late":
      return { text: `A payment did not go through. Please update your card within ${state.daysLeft} day${state.daysLeft === 1 ? "" : "s"} to keep publishing rotas.`, urgent: true };
    case "paused":
      return { text: PAUSED_MESSAGE, urgent: true };
    default:
      return null;
  }
};
