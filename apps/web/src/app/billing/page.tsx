import { BANDS, bandFor, bandPrice, PRICING } from "@vicisrota/compliance";
import Link from "next/link";
import { requireManager } from "@/lib/business";
import { planFor } from "@/lib/plan";
import { stripeConfigured } from "@/lib/stripe";
import { manageBilling } from "./actions";
import { CharityForm, ChoosePlanForm } from "./forms";

const pounds = (pence: number) => `£${(pence / 100).toLocaleString("en-GB", { minimumFractionDigits: pence % 100 ? 2 : 0 })}`;
const day = (d: Date) => d.toLocaleDateString("en-GB", { timeZone: "Europe/London", day: "numeric", month: "long", year: "numeric" });

export default async function BillingPage({ searchParams }: PageProps<"/billing">) {
  const { organisationId } = await requireManager();
  const params = await searchParams;
  const done = params.done === "1";
  const { org, staff, state } = await planFor(organisationId);
  const band = bandFor(staff);
  const charity = org.charityApproved;
  const paying = state.kind === "paid" || state.kind === "late";
  const paymentsOn = stripeConfigured();

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 lg:px-8">
      <h1 className="text-2xl font-semibold">Plan and billing</h1>

      {done && (
        <p role="status" className="mt-4 rounded-lg border border-green-600 p-3">
          Thank you. Your plan starts as soon as Stripe confirms the payment, usually within a minute.
        </p>
      )}

      {params.stripe === "down" && (
        <p role="alert" className="mt-4 rounded-lg border border-red-400 p-3">Stripe could not be reached. Please try again in a minute.</p>
      )}

      <section className="mt-6 rounded-xl border border-line bg-surface p-5 shadow-sm" aria-labelledby="now-heading">
        <h2 id="now-heading" className="text-lg font-semibold">Your plan now</h2>
        <p className="mt-2">
          {state.kind === "free" && <>You are on the free plan. Up to {PRICING.freeStaff} people, with everything included, for as long as you like.</>}
          {state.kind === "trial" && (
            <>
              Free trial: {state.daysLeft} day{state.daysLeft === 1 ? "" : "s"} left{org.trialEndsAt ? `, until ${day(org.trialEndsAt)}` : ""}. You can have as many
              people as you like until then.
            </>
          )}
          {state.kind === "paid" && (
            <>
              You pay {org.billingInterval === "year" ? "yearly" : "monthly"} for a team of up to {org.planBand ?? "?"} people{charity ? ", at the charity price" : ""}. Thank you.
            </>
          )}
          {state.kind === "late" && (
            <strong>
              A payment did not go through. Please update your card within {state.daysLeft} day{state.daysLeft === 1 ? "" : "s"} to keep publishing rotas.
            </strong>
          )}
          {state.kind === "paused" && (
            <strong>
              {state.why === "trial-ended" && "Your free trial has ended. "}
              {state.why === "payment-failed" && "Payments have not gone through for 14 days. "}
              {state.why === "cancelled" && "Your plan has been cancelled. "}
              Publishing rotas and adding people are paused until you choose a plan.
            </strong>
          )}
        </p>
        <p className="mt-2 text-muted">
          Your team: {staff} {staff === 1 ? "person" : "people"}. People you have marked as left are not counted.
        </p>
      </section>

      <section className="mt-8" aria-labelledby="prices-heading">
        <h2 id="prices-heading" className="text-lg font-semibold">Prices</h2>
        <p className="mt-1 text-muted">
          One price for your team size, with every feature included. Pay yearly and get {12 - PRICING.yearlyMonths} months free.
          {charity ? " Your charity price is half of these." : ""}
        </p>
        <table className="mt-3 w-full text-left">
          <thead>
            <tr className="border-b border-line">
              <th className="py-2">Team size</th>
              <th className="py-2">Each month</th>
              <th className="py-2">Each year</th>
            </tr>
          </thead>
          <tbody>
            <tr className={`border-b border-line ${band === "free" ? "bg-brand-soft font-semibold" : ""}`}>
              <td className="py-2">Up to {PRICING.freeStaff} people</td>
              <td className="py-2">Free</td>
              <td className="py-2">Free</td>
            </tr>
            {BANDS.map((b, i) => (
              <tr key={b.upTo} className={`border-b border-line ${band === b ? "bg-brand-soft font-semibold" : ""}`}>
                <td className="py-2">
                  {(i === 0 ? PRICING.freeStaff : BANDS[i - 1]!.upTo) + 1} to {b.upTo} people
                  {band === b && <span className="sr-only"> (your team)</span>}
                </td>
                <td className="py-2">{pounds(bandPrice(b, { charity }))}</td>
                <td className="py-2">{pounds(bandPrice(b, { charity, interval: "year" }))}</td>
              </tr>
            ))}
            <tr className={band === "large" ? "bg-brand-soft font-semibold" : ""}>
              <td className="py-2">More than {BANDS.at(-1)!.upTo} people</td>
              <td className="py-2" colSpan={2}>We agree a price with you</td>
            </tr>
          </tbody>
        </table>
        <p className="mt-2 text-sm text-muted">
          When your team grows or shrinks, your price moves to the right band from your next bill. You are never charged part-way through.
        </p>
      </section>

      <section className="mt-8" aria-labelledby="pay-heading">
        <h2 id="pay-heading" className="text-lg font-semibold">{paying ? "Your payments" : "Choose a plan"}</h2>
        {!paymentsOn ? (
          <p className="mt-2">Online payment is being set up. Until it is, nothing is paused and there is nothing to pay.</p>
        ) : paying ? null : band === "free" ? (
          <p className="mt-2">There is nothing to pay while you have {PRICING.freeStaff} people or fewer.</p>
        ) : band === "large" ? (
          <p className="mt-2">
            For teams of more than {BANDS.at(-1)!.upTo} people we agree a price with you. <Link href="/help" className="underline">Get in touch</Link> and we will reply.
          </p>
        ) : (
          <ChoosePlanForm month={pounds(bandPrice(band, { charity }))} year={pounds(bandPrice(band, { charity, interval: "year" }))} upTo={band.upTo} />
        )}
        {paymentsOn && org.stripeCustomerId && (
          <form action={manageBilling} className="mt-3">
            <button type="submit" className="rounded-lg border border-zinc-400 px-4 py-2 font-medium hover:bg-brand-soft">
              Change card, see bills or cancel
            </button>
          </form>
        )}
        {paying && band === "free" && (
          <p className="mt-3">Your team is down to {PRICING.freeStaff} people or fewer, so you can cancel and use VicisRota free.</p>
        )}
        <p className="mt-3 text-sm text-muted">
          Plans follow our <Link href="/terms#plans" className="underline">terms of service</Link>. Read how we look after your information in our{" "}
          <Link href="/privacy" className="underline">privacy policy</Link>.
        </p>
      </section>

      <section className="mt-8" aria-labelledby="charity-heading">
        <h2 id="charity-heading" className="text-lg font-semibold">Charities and community interest companies</h2>
        {charity ? (
          <p className="mt-2">Half price is on for your organisation.</p>
        ) : org.charityNumber ? (
          <p className="mt-2">We are checking number {org.charityNumber}. We will turn on half price once it is confirmed.</p>
        ) : (
          <>
            <p className="mt-2">Registered charities and CICs pay half price. Give us your number and we will check it.</p>
            <CharityForm />
          </>
        )}
      </section>

      <section className="mt-8 rounded-xl border border-line bg-brand-soft p-5" aria-labelledby="never-heading">
        <h2 id="never-heading" className="text-lg font-semibold">What never stops</h2>
        <p className="mt-1">Even if a payment fails or a plan ends, these always keep working:</p>
        <ul className="mt-2 list-disc pl-6">
          <li>Raising a safeguarding concern</li>
          <li>Lone working check-ins and alerts</li>
          <li>Clocking in and out of shifts already published</li>
          <li>Staff seeing their own shifts</li>
          <li>Timesheets, payroll files and your records</li>
        </ul>
      </section>
    </main>
  );
}
