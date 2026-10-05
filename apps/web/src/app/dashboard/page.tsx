import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { currentMembership, myBusinesses } from "@/lib/business";
import { kindLabel, PACKS } from "@/lib/sector-packs";
import { createBusiness, switchBusiness } from "../actions";
import { loadSetupSteps } from "@/lib/setup";
import { isSuperadmin } from "@/lib/superadmin";
import { managerNav } from "@/lib/nav";
import { Icon } from "../icons";
import { SetupChecklist } from "./setup-checklist";
import { planFor, planNotice } from "@/lib/plan";
import { checksDueSummary, loadChecksDue } from "@/lib/checks-due";
import { todayInUk } from "@/lib/rota";

const ROLE_LABELS = {
  owner: "Owner",
  manager: "Manager",
  worker: "Staff",
} as const;

export default async function Dashboard() {
  const user = await requireUser();
  const businesses = await myBusinesses(user.id);
  const current = await currentMembership(user.id);
  // Staff have their own page with just their shifts and leave.
  if (current?.role === "worker") redirect("/me");
  const managed = current ? { id: current.organisationId, name: current.name, sector: current.sector, kind: current.kind } : undefined;
  const setup = managed ? await loadSetupSteps(managed.id) : null;
  const superadmin = await isSuperadmin(user.id);

  const plan = managed ? planNotice((await planFor(managed.id)).state) : null;
  const checks = managed ? checksDueSummary(await loadChecksDue(managed.id, todayInUk())) : null;
  const sections = managed ? managerNav(managed.sector, false, managed.kind).filter((sec) => sec.title) : [];

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8 lg:px-8">
      <h1 className="text-2xl font-semibold sm:text-3xl">Hello, {user.name}</h1>
      {managed && (
        <p className="mt-1 text-muted">
          {managed.name} · {kindLabel(managed.kind, managed.sector)}
        </p>
      )}
      {superadmin && (
        <p className="mt-2">
          <Link href="/admin" className="font-medium text-brand underline">
            VicisRota superadmin
          </Link>
        </p>
      )}

      {plan && (
        <p role={plan.urgent ? "alert" : "status"} className={`mt-4 rounded-lg border-l-4 p-3 ${plan.urgent ? "border-warn bg-warn-soft" : "border-brand bg-brand-soft"}`}>
          {plan.text}{" "}
          <Link href="/billing" className="font-medium underline">Plan and billing</Link>
        </p>
      )}

      {checks && (
        <p className={`mt-4 rounded-lg border-l-4 p-3 ${checks.urgent ? "border-warn bg-warn-soft" : "border-brand bg-brand-soft"}`}>
          {checks.text}{" "}
          <Link href="/checks" className="font-medium underline">See checks due</Link>
        </p>
      )}

      {businesses.length > 0 ? (
        <>
          {setup && <SetupChecklist steps={setup} />}
          <div className="mt-8 grid gap-6 sm:grid-cols-2">
            {sections.map((sec, i) => (
              <section key={sec.title} aria-labelledby={`sec-${i}`} className="rounded-xl border border-line bg-surface p-5 shadow-sm">
                <h2 id={`sec-${i}`} className="text-sm font-semibold uppercase tracking-wider text-muted">
                  {sec.title}
                </h2>
                <ul className="mt-3 flex flex-col gap-1">
                  {sec.items.map((item) => (
                    <li key={item.href}>
                      <Link href={item.href} className="group flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-brand-soft">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand">
                          <Icon name={item.icon} />
                        </span>
                        <span className="flex-1 font-medium">{item.label}</span>
                        <Icon name="arrow" className="h-4 w-4 text-muted group-hover:text-brand" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
          {businesses.length > 1 && (
            <section aria-labelledby="businesses-heading" className="mt-8 rounded-xl border border-line bg-surface p-5 shadow-sm">
              <h2 id="businesses-heading" className="text-sm font-semibold uppercase tracking-wider text-muted">
                Your businesses
              </h2>
              <ul className="mt-3 flex flex-col gap-2">
                {businesses.map((b) => (
                  <li key={b.organisationId} className="flex flex-wrap items-center justify-between gap-3">
                    <span>
                      <span className="font-medium">{b.name}</span>
                      <span className="text-muted"> · {ROLE_LABELS[b.role]}</span>
                    </span>
                    {b.organisationId === current?.organisationId ? (
                      <span className="text-sm font-medium text-heading">Open now</span>
                    ) : (
                      <form action={switchBusiness}>
                        <input type="hidden" name="organisationId" value={b.organisationId} />
                        <button type="submit" className="rounded-lg border border-zinc-400 px-3 py-1.5 text-sm hover:bg-brand-soft">
                          Switch to {b.name}
                        </button>
                      </form>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}
          <details className="mt-6 rounded-xl border border-line bg-surface p-5 shadow-sm">
            <summary className="font-medium">Set up another business</summary>
            <p className="mt-2 text-muted">
              For example a second shop or home. It has its own staff, rota and records, and you switch between them with one login.
            </p>
            <NewBusinessForm />
          </details>
        </>
      ) : (
        <div className="mt-6 max-w-lg rounded-xl border border-line bg-surface p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Set up your business</h2>
          <NewBusinessForm />
        </div>
      )}
    </main>
  );
}

function NewBusinessForm() {
  return (
    <form action={createBusiness} className="mt-4 flex max-w-lg flex-col gap-4">
      <label className="flex flex-col gap-1">
        <span className="font-medium">Business name</span>
        <input name="name" required className="rounded-lg border border-zinc-400 px-3 py-2 text-base" />
      </label>
      <fieldset className="flex flex-col gap-2">
        <legend className="font-medium">What kind of business is it?</legend>
        <span className="text-sm text-muted">This decides what you see, so the app only shows what fits your work.</span>
        {PACKS.map((p) => (
          <label key={p.id} className="flex items-start gap-2">
            <input type="radio" name="kind" value={p.id} required className="mt-1" />
            <span>
              {p.label}
              <span className="block text-sm text-muted">{p.hint}</span>
            </span>
          </label>
        ))}
      </fieldset>
      <label className="flex items-start gap-2">
        <input type="checkbox" name="starter" defaultChecked className="mt-1" />
        <span>
          Start me off with the usual job roles, training and checklists for this kind of business
          <span className="block text-sm text-muted">You can change or remove any of them later.</span>
        </span>
      </label>
      <button type="submit" className="rounded-lg bg-brand px-4 py-2.5 font-medium text-on-brand hover:bg-brand-hover">
        Create business
      </button>
    </form>
  );
}
