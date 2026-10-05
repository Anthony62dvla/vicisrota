import { BANDS, evaluate, PRICING, type Context } from "@vicisrota/compliance";
import Link from "next/link";
import { Icon, Logo, type IconName } from "./icons";

// A sample week, checked live by the same rules that check real rotas.
const sample: Context = {
  asOf: "2026-10-05",
  workers: [
    { id: "amy", name: "Amy", dateOfBirth: "1990-05-01" },
    { id: "tom", name: "Tom", dateOfBirth: "2009-06-15" },
  ],
  shifts: [
    { id: "amy-close", workerId: "amy", start: "2026-10-05T16:00:00+01:00", end: "2026-10-05T23:30:00+01:00" },
    { id: "amy-open", workerId: "amy", start: "2026-10-06T09:00:00+01:00", end: "2026-10-06T13:00:00+01:00" },
    { id: "tom-eve", workerId: "tom", start: "2026-10-07T17:00:00+01:00", end: "2026-10-07T22:30:00+01:00" },
  ],
  payRates: [
    { workerId: "amy", hourlyPence: 1300, effectiveFrom: "2026-04-01" },
    { workerId: "tom", hourlyPence: 800, effectiveFrom: "2026-04-01" },
  ],
};

const FEATURES: { icon: IconName; title: string; text: string }[] = [
  {
    icon: "rota",
    title: "Rotas that check themselves",
    text: "Drag shifts around the rota board, or let the rota builder fill open shifts fairly. Rest breaks, weekly hours, under-18 limits, minimum wage and tiring patterns are checked before you publish.",
  },
  {
    icon: "profile",
    title: "Built for every mind",
    text: "Clear words, calm screens and advance notice of changes. Easy Read shifts that can be read aloud, and a private “How I work best” profile staff choose whether to share.",
  },
  {
    icon: "safeguarding",
    title: "Safeguarding at the centre",
    text: "Staff can raise a concern in a few taps. Lone workers check in, and someone is told straight away if they need help. A fire roll call shows who is safe.",
  },
  {
    icon: "today",
    title: "Clocking in, your way",
    text: "Scan a code on the shared tablet, use a PIN, or clock in from a phone at work. Late or missed starts are spotted before they become a gap.",
  },
  {
    icon: "checksDue",
    title: "Checks that never lapse",
    text: "Right to work, DBS, SIA licences, training and supervisions in one list, with a weekly reminder before anything runs out.",
  },
  {
    icon: "leave",
    title: "Leave and sickness done right",
    text: "Holiday for irregular hours, Statutory Sick Pay and working-time records, all in line with current UK rules.",
  },
  {
    icon: "timesheets",
    title: "Pay that adds up",
    text: "Confirmed hours, holiday, tips, sick pay and short-notice pay in one file for your payroll software.",
  },
  {
    icon: "messages",
    title: "Messages without the noise",
    text: "Free phone notifications for new shifts and changes, and team messages with quiet hours, so nobody is disturbed on a day off.",
  },
  {
    icon: "checklist",
    title: "Checklists, handovers and wellbeing",
    text: "Opening and closing checklists, handover notes between shifts, and optional check-ins after long or night shifts.",
  },
  {
    icon: "hiring",
    title: "Hiring made simple",
    text: "Share a short job advert, take applications without a CV, and add the right person to your team in one step.",
  },
];

const SECTORS: { icon: IconName; title: string; text: string }[] = [
  {
    icon: "clients",
    title: "Care providers",
    text: "Visits with travel time, DBS and training checks, lone working and an inspection pack, including children’s homes.",
  },
  { icon: "tips", title: "Hospitality", text: "Busy weeks, open shifts staff can pick up, and fair tip sharing under the 2023 Act." },
  { icon: "easyRead", title: "Nurseries and childcare", text: "Enhanced DBS on every shift, paediatric first aid tracking and opening checks." },
  { icon: "workplaces", title: "Shops", text: "Opening and closing checks, Challenge 25 training and a fair rota." },
  { icon: "loneWorking", title: "Cleaning and security", text: "Lone working check-ins, site checklists and SIA licence expiry dates." },
  { icon: "staff", title: "Any small business", text: "A simple rota, holiday and payroll export without the paperwork, and one login if you run more than one business." },
];

export default function Home() {
  const result = evaluate(sample);
  return (
    <div className="bg-background">
      <header className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-5 lg:px-8">
        <Logo className="h-9 w-9" />
        <span className="text-lg font-semibold tracking-tight text-heading">VicisRota</span>
        <nav aria-label="Account" className="ml-auto flex items-center gap-2">
          <Link href="/sign-in" className="whitespace-nowrap rounded-lg px-3 py-2 font-medium text-heading hover:bg-brand-soft">
            Sign in
          </Link>
          <Link href="/sign-up" className="whitespace-nowrap rounded-lg bg-brand px-4 py-2 font-medium text-on-brand hover:bg-brand-hover">
            Get started
          </Link>
        </nav>
      </header>

      <main>
        <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 pb-16 pt-8 lg:grid-cols-2 lg:px-8 lg:pt-16">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-accent bg-brand-soft px-3 py-1 text-sm font-medium text-heading">
              <span aria-hidden className="h-2 w-2 rounded-full bg-accent" />
              UK employment law built in
            </p>
            <h1 className="mt-5 text-4xl font-bold tracking-tight sm:text-5xl">Staff rotas that work for everyone on them.</h1>
            <p className="mt-5 text-lg text-muted">
              VicisRota plans shifts, checks them against UK employment law and keeps your team safe, with calm, clear screens that suit
              neurodivergent and neurotypical people alike.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/sign-up"
                className="inline-flex items-center gap-2 rounded-lg bg-brand px-5 py-3 font-medium text-on-brand hover:bg-brand-hover"
              >
                Create your business
                <Icon name="arrow" className="h-4 w-4" />
              </Link>
              <Link
                href="/sign-in"
                className="rounded-lg border border-zinc-300 bg-surface px-5 py-3 font-medium hover:bg-brand-soft dark:border-zinc-700"
              >
                Sign in
              </Link>
            </div>
          </div>

          <figure className="rounded-2xl border border-line bg-surface p-5 shadow-sm sm:p-6">
            <figcaption className="flex items-center justify-between gap-3">
              <span className="font-semibold text-heading">Checking a sample week</span>
              <span
                className={`whitespace-nowrap rounded-full px-3 py-1 text-sm font-medium text-zinc-900 ${result.publishable ? "bg-ok" : "bg-warn"}`}
              >
                {result.publishable ? "Ready to publish" : `${result.findings.length} to look at`}
              </span>
            </figcaption>
            <ul className="mt-4 flex flex-col gap-3">
              {result.findings.slice(0, 4).map((f) => (
                <li key={`${f.ruleId}:${f.shiftIds.join(",")}`} className="flex gap-3 rounded-lg border-l-4 border-warn bg-warn-soft p-3">
                  <div>
                    <p>{f.message}</p>
                    <p className="mt-1 text-sm text-muted">{f.legalRef}</p>
                  </div>
                </li>
              ))}
            </ul>
            {result.findings.length > 4 && (
              <p className="mt-3 text-sm text-muted">And {result.findings.length - 4} more, each with the law behind it and how to put it right.</p>
            )}
          </figure>
        </section>

        <section aria-labelledby="features" className="border-y border-line bg-surface py-16">
          <div className="mx-auto max-w-6xl px-4 lg:px-8">
            <h2 id="features" className="text-2xl font-semibold sm:text-3xl">
              Everything a UK team needs
            </h2>
            <ul className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((f) => (
                <li key={f.title}>
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-soft text-brand">
                    <Icon name={f.icon} className="h-6 w-6" />
                  </span>
                  <h3 className="mt-4 font-semibold">{f.title}</h3>
                  <p className="mt-1 text-muted">{f.text}</p>
                </li>
              ))}
            </ul>
            <p className="mt-10 rounded-xl bg-brand-soft p-4 text-heading">
              <span className="font-semibold">In your team’s language.</span> Staff can choose English, <span lang="cy">Cymraeg</span>,{" "}
              <span lang="pl">Polski</span> or <span lang="ro">Română</span> for their menu, Easy Read shifts, notifications and raising a
              concern.
            </p>
          </div>
        </section>

        <section aria-labelledby="sectors" className="mx-auto max-w-6xl px-4 py-16 lg:px-8">
          <h2 id="sectors" className="text-2xl font-semibold sm:text-3xl">
            Made for your kind of work
          </h2>
          <ul className="mt-8 grid gap-6 md:grid-cols-3">
            {SECTORS.map((s) => (
              <li key={s.title} className="rounded-xl border border-line bg-surface p-6 shadow-sm">
                <Icon name={s.icon} className="h-7 w-7 text-brand" />
                <h3 className="mt-3 font-semibold">{s.title}</h3>
                <p className="mt-1 text-muted">{s.text}</p>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="pricing" className="border-y border-line bg-surface py-16">
          <div className="mx-auto max-w-6xl px-4 lg:px-8">
            <h2 id="pricing" className="text-2xl font-semibold sm:text-3xl">
              Simple pricing
            </h2>
            <p className="mt-2 max-w-2xl text-muted">
              One price for your team size, with every feature included. Free for up to {PRICING.freeStaff} people, for good. Pay yearly and get{" "}
              {12 - PRICING.yearlyMonths} months free. Charities and CICs pay half.
            </p>
            <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <li className="rounded-xl border border-line p-5">
                <p className="font-semibold">Up to {PRICING.freeStaff} people</p>
                <p className="mt-2 text-3xl font-bold text-heading">Free</p>
              </li>
              {BANDS.map((b, i) => (
                <li key={b.upTo} className="rounded-xl border border-line p-5">
                  <p className="font-semibold">
                    {(i === 0 ? PRICING.freeStaff : BANDS[i - 1]!.upTo) + 1} to {b.upTo} people
                  </p>
                  <p className="mt-2 text-3xl font-bold text-heading">£{b.monthPence / 100}</p>
                  <p className="text-sm text-muted">a month</p>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-muted">
              More than {BANDS.at(-1)!.upTo} people? We agree a price with you. Start with a {PRICING.trialDays}-day free trial for any size of team, with no card needed. Safety features never switch off, whatever
              happens with payment.
            </p>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-16 lg:px-8">
          <div className="rounded-2xl bg-[#164e63] px-6 py-10 text-center sm:px-10 dark:bg-[#0c3442]">
            <h2 className="text-2xl font-semibold text-white sm:text-3xl">Ready for your first rota?</h2>
            <p className="mx-auto mt-3 max-w-xl text-cyan-50">Set up takes a few minutes, and a checklist guides you one step at a time.</p>
            <Link
              href="/sign-up"
              className="mt-6 inline-flex items-center gap-2 rounded-lg bg-white px-5 py-3 font-medium text-[#164e63] hover:bg-[#ecfeff]"
            >
              Create your business
              <Icon name="arrow" className="h-4 w-4" />
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
