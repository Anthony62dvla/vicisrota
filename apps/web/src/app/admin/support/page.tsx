import { schema } from "@vicisrota/db";
import { desc, inArray } from "drizzle-orm";
import Link from "next/link";
import { db } from "@/lib/db";
import { requireSuperadmin } from "@/lib/superadmin";
import { SUPPORT_MAX, triageConfigured } from "@/lib/support";
import { close, reply, triage } from "./actions";

const when = (d: Date) => d.toLocaleString("en-GB", { timeZone: "Europe/London", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const STATUS = { new: "New", triaged: "Triaged", replied: "Replied", closed: "Closed" } as const;
const URGENCY = {
  urgent: "bg-red-600 text-white",
  high: "bg-warn text-zinc-900",
  normal: "bg-accent text-zinc-900",
  low: "bg-zinc-200 text-zinc-900 dark:bg-zinc-700 dark:text-zinc-100",
} as const;
const VIEWS = { open: ["new", "triaged"], replied: ["replied"], closed: ["closed"] } as const;

/**
 * Problem reports from customers. The assistant suggests a triage and a reply; a VicisRota person decides
 * what to do and sends any reply. Reports are what people chose to write, so treat them as personal data.
 */
export default async function SupportPage({ searchParams }: PageProps<"/admin/support">) {
  await requireSuperadmin();
  const viewParam = String((await searchParams).view ?? "open");
  const view = (viewParam in VIEWS ? viewParam : "open") as keyof typeof VIEWS;
  const reports = await db
    .select()
    .from(schema.supportReport)
    .where(inArray(schema.supportReport.status, [...VIEWS[view]]))
    .orderBy(desc(schema.supportReport.createdAt))
    .limit(100);
  const orgIds = [...new Set(reports.map((r) => r.organisationId).filter((id): id is string => Boolean(id)))];
  const orgs = orgIds.length
    ? await db.select({ id: schema.organisation.id, name: schema.organisation.name }).from(schema.organisation).where(inArray(schema.organisation.id, orgIds))
    : [];
  const orgName = new Map(orgs.map((o) => [o.id, o.name]));
  const assistant = triageConfigured();

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8 lg:px-8">
      <p>
        <Link href="/admin" className="text-sm text-muted underline">
          Back to superadmin
        </Link>
      </p>
      <h1 className="mt-1 text-2xl font-semibold">Support</h1>
      <p className="mt-1">
        Problems reported by managers and staff. The assistant suggests a triage and a reply. Nothing reaches the customer until you send it.
      </p>
      {!assistant && (
        <p className="mt-3 rounded-lg border-l-4 border-warn bg-warn-soft p-3 text-sm">
          The assistant is off. Add <code>ANTHROPIC_API_KEY</code> to <code>deploy/app.env</code> and run <code>./update.sh</code> to switch it on.
          Reports still arrive and can be answered by hand.
        </p>
      )}

      <nav aria-label="Reports" className="mt-6 flex gap-2">
        {(Object.keys(VIEWS) as (keyof typeof VIEWS)[]).map((v) => (
          <Link
            key={v}
            href={`/admin/support?view=${v}`}
            aria-current={v === view ? "page" : undefined}
            className={`rounded-full px-4 py-1.5 text-sm font-medium ${v === view ? "bg-brand text-on-brand" : "border border-zinc-300 bg-surface dark:border-zinc-700"}`}
          >
            {v === "open" ? "Open" : v === "replied" ? "Replied" : "Closed"}
          </Link>
        ))}
      </nav>

      {reports.length === 0 ? (
        <p className="mt-6">Nothing here.</p>
      ) : (
        <ul className="mt-6 flex flex-col gap-5">
          {reports.map((r) => (
            <li key={r.id} className="rounded-xl border border-line bg-surface p-5 shadow-sm">
              <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
                <span>{when(r.createdAt)}</span>·<span>{r.organisationId ? (orgName.get(r.organisationId) ?? "Unknown business") : "No business"}</span>·
                <span>{r.reporterRole === "worker" ? "Staff" : "Manager"}</span>
                {r.page && (
                  <>
                    ·<code>{r.page}</code>
                  </>
                )}
                {r.errorRef && (
                  <>
                    ·
                    <Link href={`/admin?ref=${encodeURIComponent(r.errorRef)}`} className="font-mono underline">
                      {r.errorRef}
                    </Link>
                  </>
                )}
                <span className="ml-auto rounded-full border border-zinc-300 px-2 py-0.5 dark:border-zinc-700">{STATUS[r.status]}</span>
              </div>
              <p className="mt-3 whitespace-pre-line">{r.what}</p>

              {r.triage ? (
                <section aria-label="Assistant's triage" className="mt-4 rounded-lg bg-brand-soft p-4">
                  {r.triage.possibleSafeguarding && (
                    <p className="mb-3 rounded-lg bg-red-600 p-3 font-medium text-white">
                      This may be a safeguarding concern. Support cannot handle it: point them to their safeguarding procedure, and to 999 if
                      anyone is in immediate danger.
                    </p>
                  )}
                  <p className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-2.5 py-0.5 text-sm font-semibold ${URGENCY[r.triage.urgency]}`}>{r.triage.urgency}</span>
                    <span className="font-semibold text-heading">{r.triage.area}</span>
                  </p>
                  <p className="mt-2">{r.triage.summary}</p>
                  <p className="mt-2 text-sm">
                    <strong>Likely cause:</strong> {r.triage.likelyCause}
                  </p>
                  <ul className="mt-2 list-disc pl-5 text-sm">
                    {r.triage.nextSteps.map((s) => (
                      <li key={s}>{s}</li>
                    ))}
                  </ul>
                  <p className="mt-2 text-xs text-muted">Suggested by the assistant ({r.triage.model}). Check before acting.</p>
                </section>
              ) : (
                assistant &&
                r.status !== "closed" && (
                  <form action={triage} className="mt-4">
                    <input type="hidden" name="id" value={r.id} />
                    <button type="submit" className="rounded-lg border border-brand px-4 py-2 font-medium text-brand hover:bg-brand-soft">
                      Ask the assistant to triage
                    </button>
                  </form>
                )
              )}

              {r.reply ? (
                <div className="mt-4 border-l-4 border-ok pl-3">
                  <p className="text-sm font-semibold">Your reply{r.repliedAt && `, ${when(r.repliedAt)}`}</p>
                  <p className="mt-1 whitespace-pre-line">{r.reply}</p>
                </div>
              ) : (
                r.status !== "closed" && (
                  <form action={reply} className="mt-4 flex flex-col gap-2">
                    <input type="hidden" name="id" value={r.id} />
                    <label className="flex flex-col gap-1">
                      <span className="font-medium">Reply</span>
                      <span className="text-sm text-muted">They see this on their Report a problem page.</span>
                      <textarea
                        name="reply"
                        required
                        maxLength={SUPPORT_MAX}
                        rows={6}
                        defaultValue={r.triage?.suggestedReply ?? ""}
                        className="rounded-lg border border-zinc-400 px-3 py-2 text-base"
                      />
                    </label>
                    <button type="submit" className="self-start rounded-lg bg-brand px-4 py-2 font-medium text-on-brand hover:bg-brand-hover">
                      Send reply
                    </button>
                  </form>
                )
              )}
              {r.status !== "closed" && (
                <form action={close} className="mt-3">
                  <input type="hidden" name="id" value={r.id} />
                  <button type="submit" className="text-sm text-muted underline">
                    Close without replying
                  </button>
                </form>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
