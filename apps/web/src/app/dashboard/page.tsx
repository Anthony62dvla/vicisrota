import { schema } from "@vicisrota/db";
import { eq } from "drizzle-orm";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { createBusiness } from "../actions";
import { loadSetupSteps } from "@/lib/setup";
import { isSuperadmin } from "@/lib/superadmin";
import { managerNav } from "@/lib/nav";
import { Icon } from "../icons";
import { SetupChecklist } from "./setup-checklist";

const SECTOR_LABELS = { care: "Care provider", hospitality: "Hospitality", small_business: "Small business" } as const;

export default async function Dashboard() {
  const user = await requireUser();
  const businesses = await db
    .select({ id: schema.organisation.id, name: schema.organisation.name, sector: schema.organisation.sector, role: schema.membership.role })
    .from(schema.membership)
    .innerJoin(schema.organisation, eq(schema.membership.organisationId, schema.organisation.id))
    .where(eq(schema.membership.userId, user.id))
    .orderBy(schema.membership.createdAt);
  // Staff have their own page with just their shifts and leave.
  if (businesses.length > 0 && businesses.every((b) => b.role === "worker")) redirect("/me");
  // Pages work on the first business someone manages, so setup is shown for that one.
  const managed = businesses.find((b) => b.role !== "worker");
  const setup = managed ? await loadSetupSteps(managed.id) : null;
  const superadmin = await isSuperadmin(user.id);

  const sections = managed ? managerNav(managed.sector, false).filter((sec) => sec.title) : [];

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8 lg:px-8">
      <h1 className="text-2xl font-semibold sm:text-3xl">Hello, {user.name}</h1>
      {managed && (
        <p className="mt-1 text-muted">
          {managed.name} · {SECTOR_LABELS[managed.sector]}
        </p>
      )}
      {superadmin && (
        <p className="mt-2">
          <Link href="/admin" className="font-medium text-brand underline">VicisRota superadmin</Link>
        </p>
      )}

      {businesses.length > 0 ? (
        <>
        {setup && <SetupChecklist steps={setup} />}
        <div className="mt-8 grid gap-6 sm:grid-cols-2">
          {sections.map((sec, i) => (
            <section key={sec.title} aria-labelledby={`sec-${i}`} className="rounded-xl border border-line bg-surface p-5 shadow-sm">
              <h2 id={`sec-${i}`} className="text-sm font-semibold uppercase tracking-wider text-muted">{sec.title}</h2>
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
        </>
      ) : (
        <form action={createBusiness} className="mt-6 flex max-w-lg flex-col gap-4 rounded-xl border border-line bg-surface p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Set up your business</h2>
          <label className="flex flex-col gap-1">
            <span className="font-medium">Business name</span>
            <input name="name" required className="rounded-lg border border-zinc-400 px-3 py-2 text-base" />
          </label>
          <fieldset className="flex flex-col gap-2">
            <legend className="font-medium">What kind of business is it?</legend>
            {Object.entries(SECTOR_LABELS).map(([value, label]) => (
              <label key={value} className="flex items-center gap-2">
                <input type="radio" name="sector" value={value} required /> {label}
              </label>
            ))}
          </fieldset>
          <button type="submit" className="rounded-lg bg-brand px-4 py-2.5 font-medium text-on-brand hover:bg-brand-hover">
            Create business
          </button>
        </form>
      )}
    </main>
  );
}
