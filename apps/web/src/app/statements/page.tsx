import { STATEMENT_DEFAULTS, STATEMENT_LEGAL_REF } from "@vicisrota/compliance";
import { schema, withOrganisation } from "@vicisrota/db";
import { desc, eq, isNull } from "drizzle-orm";
import Link from "next/link";
import { requireManager } from "@/lib/business";
import { db } from "@/lib/db";
import { TERM_FIELDS, termsOf } from "@/lib/statements";
import { TermsForm } from "./forms";

const ukDate = (d: Date) => d.toLocaleDateString("en-GB", { timeZone: "Europe/London", day: "numeric", month: "long", year: "numeric" });

/** Written statements of particulars: who has one, who has read it, and the business's own terms. */
export default async function StatementsPage() {
  const { organisationId } = await requireManager();
  const { org, workers, given } = await withOrganisation(db, organisationId, async (tx) => ({
    org: (await tx.select().from(schema.organisation).where(eq(schema.organisation.id, organisationId)))[0]!,
    workers: await tx.select().from(schema.worker).where(isNull(schema.worker.leftOn)).orderBy(schema.worker.fullName),
    given: await tx.select().from(schema.writtenStatement).orderBy(desc(schema.writtenStatement.issuedAt)),
  }));
  const latest = new Map<string, (typeof given)[number]>();
  for (const s of given) if (!latest.has(s.workerId)) latest.set(s.workerId, s);
  const terms = termsOf(org.statementTerms);
  const without = workers.filter((w) => !latest.has(w.id)).length;

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 lg:px-8">
      <h1 className="text-2xl font-semibold">Written statements</h1>
      <p className="mt-2 text-zinc-700 dark:text-zinc-300">
        Everyone who works for you, employees and workers alike, must have a written statement of their main terms on or before their first day. VicisRota
        fills it in from what it already knows, you check it, and the person reads it in their own account.
      </p>
      <p className="mt-2 text-sm text-muted">Based on: {STATEMENT_LEGAL_REF}. A statement is not a full contract. Ask an adviser if your terms are unusual.</p>

      <section className="mt-8" aria-labelledby="people-heading">
        <h2 id="people-heading" className="text-lg font-semibold">Your team</h2>
        {workers.length === 0 ? (
          <p className="mt-2">
            Nobody is on your team yet. Add people on the <Link href="/staff" className="underline">Staff page</Link>.
          </p>
        ) : (
          <>
            {without > 0 && (
              <p className="mt-2 rounded-lg border-2 border-amber-500 p-3">
                {without === 1 ? "1 person has" : `${without} people have`} no written statement yet.
              </p>
            )}
            <ul className="mt-3 divide-y divide-zinc-200 rounded-lg border border-zinc-300 dark:divide-zinc-800 dark:border-zinc-700">
              {workers.map((w) => {
                const s = latest.get(w.id);
                return (
                  <li key={w.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
                    <div>
                      <p className="font-medium">{w.fullName}</p>
                      <p className="text-sm text-muted">
                        {!s ? "No statement yet" : `Given ${ukDate(s.issuedAt)}. ${s.readAt ? `Read ${ukDate(s.readAt)}.` : "Not read yet."}`}
                      </p>
                    </div>
                    <div className="flex gap-3">
                      {s && (
                        <Link href={`/statements/${s.id}`} className="underline">
                          View
                        </Link>
                      )}
                      <Link href={`/statements/give/${w.id}`} className="underline">
                        {s ? "Give a new one" : "Give statement"}
                      </Link>
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </section>

      <section className="mt-10" aria-labelledby="terms-heading">
        <h2 id="terms-heading" className="text-lg font-semibold">Your business&apos;s terms</h2>
        <p className="mt-1">These are the same for everyone. If anything changes, give people a new statement within one month of the change.</p>
        <TermsForm
          payInterval={terms.payInterval ?? STATEMENT_DEFAULTS.payInterval}
          fields={TERM_FIELDS.map((f) => ({ key: f.key, label: f.label, value: terms[f.key] ?? "", fallback: STATEMENT_DEFAULTS[f.key] }))}
        />
      </section>
    </main>
  );
}
