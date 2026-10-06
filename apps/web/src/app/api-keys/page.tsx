import { schema } from "@vicisrota/db";
import { and, desc, eq, isNull } from "drizzle-orm";
import { requireManager } from "@/lib/business";
import { db } from "@/lib/db";
import { MAX_DAYS } from "@/lib/api";
import { revokeApiKey } from "./actions";
import { CreateKeyForm } from "./forms";

const when = (d: Date | null) => (d ? d.toLocaleString("en-GB", { timeZone: "Europe/London", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "never");

const ENDPOINTS = [
  { path: "/api/v1/staff", what: "Everyone on the team: name, payroll ID, start and leaving dates, and job roles. No dates of birth, contact details, checks or health information." },
  { path: "/api/v1/shifts?from=2026-10-12&to=2026-10-18", what: "Published shifts, with breaks, role, workplace and who is working. Open shifts have no staffId." },
  { path: "/api/v1/timesheets?from=2026-10-01&to=2026-10-31", what: "Confirmed hours, gross pay and leave per person for a pay period: the same figures as the payroll export." },
  { path: "/api/v1/leave?from=2026-10-01&to=2026-10-31", what: "Approved time off in the period, by kind. Reasons for sickness are never included." },
];

/** Read-only API keys, so a business's own systems can use its rota and hours. */
export default async function ApiKeysPage() {
  const { organisationId } = await requireManager();
  // api_key has no row-level security, so the business is filtered here.
  const keys = await db
    .select()
    .from(schema.apiKey)
    .where(and(eq(schema.apiKey.organisationId, organisationId), isNull(schema.apiKey.revokedAt)))
    .orderBy(desc(schema.apiKey.createdAt));

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 lg:px-8">
      <h1 className="text-2xl font-semibold">API keys</h1>
      <p className="mt-2 text-zinc-700 dark:text-zinc-300">
        Let your other software read your rota, hours and time off, for example an accounts package, a dashboard or an automation tool. Keys can only read:
        nothing can be changed through them. Anyone with a key can read this information, so treat it like a password, and revoke any key you no longer use.
      </p>

      <section className="mt-8" aria-labelledby="keys-heading">
        <h2 id="keys-heading" className="text-lg font-semibold">Your keys</h2>
        {keys.length === 0 ? (
          <p className="mt-2">No keys yet.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {keys.map((k) => (
              <li key={k.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-300 p-3 dark:border-zinc-700">
                <div>
                  <p className="font-medium">{k.name}</p>
                  <p className="text-sm text-muted">
                    <span className="font-mono">{k.prefix}…</span> · created {when(k.createdAt)} · last used {when(k.lastUsedAt)}
                  </p>
                </div>
                <form action={revokeApiKey}>
                  <input type="hidden" name="id" value={k.id} />
                  <button type="submit" className="rounded-lg border border-zinc-400 px-3 py-1">
                    Revoke {k.name}
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
        <CreateKeyForm />
      </section>

      <section className="mt-10" aria-labelledby="docs-heading">
        <h2 id="docs-heading" className="text-lg font-semibold">For developers</h2>
        <p className="mt-1">
          Send the key in the Authorization header: <code className="font-mono">Authorization: Bearer vr_live_…</code>. Every response is JSON with the results in{" "}
          <code className="font-mono">data</code>. Times are in UTC (ISO 8601); dates are UK dates. Periods can be up to {MAX_DAYS} days.
        </p>
        <ul className="mt-3 flex flex-col gap-3">
          {ENDPOINTS.map((e) => (
            <li key={e.path}>
              <code className="font-mono text-sm break-all">GET https://www.vicisrota.app{e.path}</code>
              <p className="mt-1 text-sm">{e.what}</p>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
