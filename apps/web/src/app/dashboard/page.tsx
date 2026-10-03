import { schema } from "@vicisrota/db";
import { eq } from "drizzle-orm";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { createBusiness } from "../actions";
import { loadSetupSteps } from "@/lib/setup";
import { SetupChecklist } from "./setup-checklist";
import { SignOutButton } from "./sign-out";

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

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-12">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Hello, {user.name}</h1>
        <SignOutButton />
      </div>

      {businesses.length > 0 ? (
        <>
        {setup && <SetupChecklist steps={setup} />}
        <nav className="mt-6 flex flex-wrap gap-4" aria-label="Main">
          <Link href="/rota" className="rounded-lg border border-zinc-400 px-4 py-2">Rota</Link>
          <Link href="/staff" className="rounded-lg border border-zinc-400 px-4 py-2">Staff</Link>
          <Link href="/leave" className="rounded-lg border border-zinc-400 px-4 py-2">Leave</Link>
          <Link href="/timesheets" className="rounded-lg border border-zinc-400 px-4 py-2">Timesheets</Link>
          {businesses.some((b) => b.sector !== "care") && (
            <Link href="/tips" className="rounded-lg border border-zinc-400 px-4 py-2">Tips</Link>
          )}
          {businesses.some((b) => b.sector === "care") && (
            <Link href="/clients" className="rounded-lg border border-zinc-400 px-4 py-2">Clients</Link>
          )}
          <Link href="/workplaces" className="rounded-lg border border-zinc-400 px-4 py-2">Workplaces</Link>
          <Link href="/lone-working" className="rounded-lg border border-zinc-400 px-4 py-2">Lone working</Link>
          <Link href="/safeguarding" className="rounded-lg border border-zinc-400 px-4 py-2">Safeguarding</Link>
        </nav>
        <ul className="mt-6 space-y-3">
          {businesses.map((b) => (
            <li key={b.id} className="rounded-lg border border-zinc-300 p-4 dark:border-zinc-700">
              <p className="font-medium">{b.name}</p>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                {SECTOR_LABELS[b.sector]} · {b.role}
              </p>
            </li>
          ))}
        </ul>
        </>
      ) : (
        <form action={createBusiness} className="mt-6 flex flex-col gap-4">
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
          <button type="submit" className="rounded-lg bg-zinc-900 px-4 py-2 text-white dark:bg-zinc-100 dark:text-zinc-900">
            Create business
          </button>
        </form>
      )}
    </main>
  );
}
