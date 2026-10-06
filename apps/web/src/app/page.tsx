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

type Feature = { icon: IconName; title: string; text: string };

// Every feature in the app, grouped the way a manager thinks about their week.
const GROUPS: { id: string; title: string; intro: string; features: Feature[] }[] = [
  {
    id: "plan",
    title: "Plan the rota",
    intro: "Build a fair week quickly, with the law checked as you go.",
    features: [
      {
        icon: "rota",
        title: "A rota that checks itself",
        text: "Drag shifts around the board, or let the rota builder fill open shifts. Rest breaks, weekly hours, under-18 limits, minimum wage and tiring patterns are checked before you publish, and each warning explains the rule.",
      },
      {
        icon: "roles",
        title: "Repeating patterns and roles",
        text: "Save a week as a pattern and use it again. Give people roles and skills, so only the right person is offered the right shift.",
      },
      {
        icon: "staffing",
        title: "Safe staffing levels",
        text: "Set how many people, and which skills, each shift needs. Gaps and thin cover are shown before the rota goes out.",
      },
      {
        icon: "fairness",
        title: "Fair shares for everyone",
        text: "See who has had the weekends, nights and late finishes, so the less popular shifts are shared out fairly.",
      },
      {
        icon: "timesheets",
        title: "Wage costs and busy days",
        text: "Watch the wage bill as you plan, and compare it with your sales forecast to staff the busy days well.",
      },
      {
        icon: "guaranteedHours",
        title: "Guaranteed hours and fair notice",
        text: "Track the hours people usually work, and the notice they are owed, ready for the new rules in the Employment Rights Act 2025.",
      },
    ],
  },
  {
    id: "team",
    title: "Your team, on their phones",
    intro: "Staff see their week, swap shifts and ask for time off, with no app store needed.",
    features: [
      {
        icon: "today",
        title: "Their week at a glance",
        text: "Each person sees their shifts and who they work with. Add VicisRota to the phone’s home screen, and get free notifications when something changes.",
      },
      {
        icon: "rota",
        title: "Swaps and open shifts",
        text: "Staff swap with a colleague or pick up an open shift. Every swap is checked against the law before it is approved.",
      },
      {
        icon: "leave",
        title: "Holiday and availability",
        text: "Staff ask for leave and say when they can work. Holiday for irregular hours is worked out for you.",
      },
      {
        icon: "messages",
        title: "Messages and announcements",
        text: "Team messages and announcements with quiet hours, so nobody is disturbed on a day off. Rota changes can also go by text message.",
      },
      {
        icon: "checklist",
        title: "Checklists and handovers",
        text: "Opening and closing checklists, and handover notes so the next shift knows what happened.",
      },
      {
        icon: "wellbeing",
        title: "Wellbeing check-ins",
        text: "Optional check-ins after long or night shifts. Answers are private, and asking for support never counts against anyone.",
      },
    ],
  },
  {
    id: "minds",
    title: "Built for every mind",
    intro: "Calm, clear screens that suit neurodivergent and neurotypical people alike.",
    features: [
      {
        icon: "easyRead",
        title: "Easy Read shifts",
        text: "Shifts in short sentences with simple pictures, which can be read aloud. Every screen uses plain words and says what to do next.",
      },
      {
        icon: "display",
        title: "Calm mode and display choices",
        text: "Calm mode keeps the essentials on screen and tucks the rest away. Anyone can choose larger text, easier reading, softer colours or no movement.",
      },
      {
        icon: "profile",
        title: "“How I work best”",
        text: "A private profile where staff can share what helps them, such as notice of changes or a quiet break. They choose who sees it.",
      },
      {
        icon: "messages",
        title: "In your team’s language",
        text: "Staff can use English, Welsh, Polish or Romanian for their menu, Easy Read shifts, notifications and raising a concern.",
      },
    ],
  },
  {
    id: "pay",
    title: "Hours and pay",
    intro: "From clocking in to payroll, with the sums done for you.",
    features: [
      {
        icon: "today",
        title: "Clocking in, your way",
        text: "Scan a code on a shared tablet, use a PIN, or clock in from a phone at work. Late or missed starts are spotted before they become a gap.",
      },
      {
        icon: "timesheets",
        title: "Timesheets to payroll",
        text: "Confirm hours in one place, then send one file to your payroll software with holiday, sick pay and extras included.",
      },
      {
        icon: "sickness",
        title: "Sickness and sick pay",
        text: "Record sickness kindly, and Statutory Sick Pay is worked out for you. Return-to-work notes stay private.",
      },
      {
        icon: "shortNotice",
        title: "Short-notice pay",
        text: "When a shift is cancelled or cut at short notice, the app shows what the person may be owed.",
      },
      {
        icon: "tips",
        title: "Fair tips",
        text: "Share tips fairly and keep the records the Employment (Allocation of Tips) Act 2023 asks for.",
      },
      {
        icon: "workingTime",
        title: "Working time records",
        text: "Weekly hours, night work and opt-outs recorded as you go, ready if anyone asks to see them.",
      },
    ],
  },
  {
    id: "safety",
    title: "Safety and safeguarding",
    intro: "These features never switch off, whatever happens with payment.",
    features: [
      {
        icon: "safeguarding",
        title: "Raise a concern",
        text: "Anyone can raise a safeguarding or whistleblowing concern in a few taps. It goes straight to the right person, with outside contacts if they need them.",
      },
      {
        icon: "loneWorking",
        title: "Lone working",
        text: "People working alone check in on their phone, with a help button. Someone is told straight away if a check-in is missed.",
      },
      {
        icon: "rollCall",
        title: "Fire roll call",
        text: "One screen shows who is on site, so you can mark everyone safe during an alarm.",
      },
      {
        icon: "checksDue",
        title: "Checks that never lapse",
        text: "Right to work, DBS, SIA and personal licences, training and supervisions in one list, with a reminder before anything runs out.",
      },
      {
        icon: "sponsorship",
        title: "Sponsored workers and young people",
        text: "Sponsor duties and reporting deadlines for visa workers, child work permits and under-18 rules, and health checks for night workers.",
      },
      {
        icon: "workplaces",
        title: "Martyn’s Law readiness",
        text: "Record each venue’s capacity, review your procedures and brief staff, for places covered by the Terrorism (Protection of Premises) Act 2025.",
      },
    ],
  },
  {
    id: "run",
    title: "Run the business",
    intro: "The paperwork around your team, kept in one place.",
    features: [
      {
        icon: "hiring",
        title: "Hiring made simple",
        text: "Share a short job advert, take applications without a CV, and add the right person to your team in one step.",
      },
      {
        icon: "statements",
        title: "Written statements",
        text: "Give each new starter the written statement of terms the law requires from day one, and see when they have read it.",
      },
      {
        icon: "agency",
        title: "Agency workers",
        text: "Add agency staff to the rota and track the 12-week point when equal treatment begins.",
      },
      {
        icon: "inspection",
        title: "Inspection pack",
        text: "Pull together rotas, checks, training and records in one pack when an inspector or auditor visits.",
      },
      {
        icon: "workplaces",
        title: "More than one site",
        text: "Run several workplaces, or several businesses with one login, and print a poster with each site’s clock-in code.",
      },
      {
        icon: "security",
        title: "Your data, protected",
        text: "UK-hosted, with two-step sign-in, data downloads for staff, records deleted on time, and an API for your other tools.",
      },
    ],
  },
];

const SECTORS: { icon: IconName; title: string; text: string }[] = [
  {
    icon: "clients",
    title: "Care providers",
    text: "Visits with travel time, sleep-ins, DBS and training checks, lone working and an inspection pack, including children’s homes.",
  },
  { icon: "tips", title: "Hospitality", text: "Busy weeks, open shifts staff can pick up, personal licence holders on every shift, and fair tip sharing under the 2023 Act." },
  { icon: "easyRead", title: "Nurseries and childcare", text: "Enhanced DBS on every shift, paediatric first aid tracking and opening checks." },
  { icon: "workplaces", title: "Shops", text: "Opening and closing checks, Challenge 25 training, Sunday working opt-outs and a fair rota." },
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

        <section aria-labelledby="video" className="mx-auto max-w-4xl px-4 pb-16 lg:px-8">
          <h2 id="video" className="text-2xl font-semibold sm:text-3xl">
            See VicisRota in a minute
          </h2>
          <p className="mt-2 text-muted">Real screens from the app, with a made-up café and team. There is no sound, and it only plays when you press play.</p>
          {/* No autoplay, so nothing moves on the page until someone chooses it. */}
          <video
            controls
            muted
            playsInline
            preload="none"
            poster="/video/vicisrota-advert-poster.jpg"
            aria-describedby="video-description"
            className="mt-6 aspect-video w-full rounded-2xl border border-line bg-surface shadow-sm"
          >
            <source src="/video/vicisrota-advert.mp4" type="video/mp4" />
            <source src="/video/vicisrota-advert.webm" type="video/webm" />
          </video>
          <details id="video-description" className="mt-3 text-muted">
            <summary className="cursor-pointer">What the video shows</summary>
            <ol className="mt-2 list-decimal space-y-1 pl-6">
              <li>Rotas shouldn’t keep you up at night: no more sticky notes, spreadsheets and late-night worry.</li>
              <li>
                A manager’s rota. Two shifts too close together are marked, and the warning explains the rule: 11 hours’ rest is required (Working Time
                Regulations 1998, reg 10).
              </li>
              <li>A staff member’s phone showing their shifts and who they work with, and swapping a shift with a colleague. Every swap is checked first.</li>
              <li>Someone working alone checks in on their phone, with a help button. Calm mode, Easy Read and larger text let everyone use it their way.</li>
              <li>VicisRota: rotas made fair, safe and simple. Free for up to 5 people, with a 30-day free trial.</li>
            </ol>
          </details>
        </section>

        <section aria-labelledby="features" className="border-y border-line bg-surface py-16">
          <div className="mx-auto max-w-6xl px-4 lg:px-8">
            <h2 id="features" className="text-2xl font-semibold sm:text-3xl">
              Everything a UK team needs
            </h2>
            <p className="mt-2 max-w-2xl text-muted">Every feature is included on every plan, even the free one. Jump to what matters most to you.</p>
            <nav aria-label="Features" className="mt-6">
              <ul className="flex flex-wrap gap-2">
                {GROUPS.map((g) => (
                  <li key={g.id}>
                    <a href={`#${g.id}`} className="inline-block rounded-full border border-line bg-background px-4 py-2 font-medium text-heading hover:bg-brand-soft">
                      {g.title}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
            {GROUPS.map((g) => (
              <section key={g.id} aria-labelledby={g.id} className="mt-14 scroll-mt-6">
                <h3 id={g.id} className="text-xl font-semibold text-heading sm:text-2xl">
                  {g.title}
                </h3>
                <p className="mt-1 text-muted">{g.intro}</p>
                <ul className={`mt-6 grid gap-6 sm:grid-cols-2 ${g.features.length % 3 === 0 ? "lg:grid-cols-3" : ""}`}>
                  {g.features.map((f) => (
                    <li key={f.title} className="rounded-xl border border-line bg-background p-5">
                      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-soft text-brand">
                        <Icon name={f.icon} className="h-6 w-6" />
                      </span>
                      <h4 className="mt-4 font-semibold">{f.title}</h4>
                      <p className="mt-1 text-muted">{f.text}</p>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
            <p className="mt-12 text-sm text-muted">
              VicisRota checks rotas against UK employment rules to help you get things right. It does not replace legal advice.
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
