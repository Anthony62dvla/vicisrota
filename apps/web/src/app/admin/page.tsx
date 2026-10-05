import { kindLabel } from "@/lib/sector-packs";
import { schema, withOrganisation } from "@vicisrota/db";
import { and, count, desc, eq, inArray, isNotNull, isNull, ne } from "drizzle-orm";
import Link from "next/link";
import { db } from "@/lib/db";
import { loadSetupSteps } from "@/lib/setup";
import { recordPlatformAction, requireSuperadmin } from "@/lib/superadmin";
import { planState } from "@vicisrota/compliance";
import { ApproveCharityButton, NewOwnerLinkButton, OnboardForm } from "./forms";

const when = (d: Date | null | undefined) =>
  d ? d.toLocaleString("en-GB", { timeZone: "Europe/London", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "Never";

const planLine = (org: typeof schema.organisation.$inferSelect, staff: number) => {
  const state = planState({
    now: new Date(),
    staff,
    trialEndsAt: org.trialEndsAt,
    subscription: org.subscriptionStatus ? { status: org.subscriptionStatus, pastDueSince: org.pastDueSince } : null,
  });
  const charity = org.charityApproved ? ", charity price" : "";
  switch (state.kind) {
    case "free":
      return `free (${staff} people)${charity}`;
    case "trial":
      return `trial, ${state.daysLeft} days left${charity}`;
    case "paid":
      return `paying ${org.billingInterval === "year" ? "yearly" : "monthly"}, up to ${org.planBand ?? "?"} people${charity}`;
    case "late":
      return `payment failed, ${state.daysLeft} days before planning pauses${charity}`;
    case "paused":
      return `planning paused (${state.why.replace("-", " ")})${charity}`;
  }
};

/**
 * The superadmin area: every customer business at a glance, onboarding, and finding what happened behind an
 * error reference. It shows counts and progress only. Staff names, shifts, sickness, adjustments and
 * safeguarding concerns are never shown here; support works from those through the business's own people.
 */
export default async function AdminPage({ searchParams }: PageProps<"/admin">) {
  const admin = await requireSuperadmin();
  const ref = String((await searchParams).ref ?? "").trim().toUpperCase();

  const orgs = await db.select().from(schema.organisation).orderBy(desc(schema.organisation.createdAt));
  const [openReports] = await db.select({ n: count() }).from(schema.supportReport).where(inArray(schema.supportReport.status, ["new", "triaged"]));
  const ids = orgs.map((o) => o.id);
  const [owners, ownerLinks] = ids.length
    ? await Promise.all([
        db
          .select({ organisationId: schema.membership.organisationId, n: count() })
          .from(schema.membership)
          .where(and(inArray(schema.membership.organisationId, ids), ne(schema.membership.role, "worker")))
          .groupBy(schema.membership.organisationId),
        db.select().from(schema.ownerInvitation).where(inArray(schema.ownerInvitation.organisationId, ids)).orderBy(desc(schema.ownerInvitation.createdAt)),
      ])
    : [[], []];
  const managers = new Map(owners.map((o) => [o.organisationId, o.n]));

  // Each business is read under its own row-level security setting, one at a time.
  const rows = await Promise.all(
    orgs.map(async (o) => {
      const [facts, steps] = await Promise.all([
        withOrganisation(db, o.id, async (tx) => {
          const [[staff], [logins], [last], found] = await Promise.all([
            tx.select({ n: count() }).from(schema.worker).where(isNull(schema.worker.leftOn)),
            tx.select({ n: count() }).from(schema.worker).where(isNotNull(schema.worker.userId)),
            tx.select({ at: schema.auditEvent.at }).from(schema.auditEvent).orderBy(desc(schema.auditEvent.at)).limit(1),
            ref
              ? tx
                  .select({ action: schema.auditEvent.action, entity: schema.auditEvent.entity, at: schema.auditEvent.at })
                  .from(schema.auditEvent)
                  .where(eq(schema.auditEvent.requestId, ref))
              : Promise.resolve([]),
          ]);
          return { staff: staff?.n ?? 0, logins: logins?.n ?? 0, lastActive: last?.at, found };
        }),
        loadSetupSteps(o.id),
      ]);
      const required = steps.filter((s) => !s.optional);
      const link = ownerLinks.find((l) => l.organisationId === o.id);
      return { org: o, ...facts, setupDone: required.filter((s) => s.done).length, setupTotal: required.length, managers: managers.get(o.id) ?? 0, link };
    }),
  );
  const matches = rows.flatMap((r) => r.found.map((f) => ({ ...f, business: r.org.name })));
  if (ref) await recordPlatformAction(admin.id, "lookup_reference", null, { reference: ref, matches: matches.length });

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8 lg:px-8">
      <p>
        <Link href="/dashboard" className="underline">Dashboard</Link>
      </p>
      <h1 className="mt-2 text-2xl font-semibold">VicisRota superadmin</h1>
      <p className="mt-2 text-zinc-700 dark:text-zinc-300">
        Customer businesses, onboarding and error references. Only counts and progress are shown: never staff names, shifts, sickness,
        adjustments or safeguarding concerns. Everything you do here is recorded.
      </p>

      <section className="mt-8 flex flex-wrap items-center gap-4 rounded-xl border border-line bg-surface p-5 shadow-sm" aria-labelledby="support-heading">
        <div className="flex-1">
          <h2 id="support-heading" className="text-lg font-semibold">Support</h2>
          <p className="text-sm text-muted">
            {openReports?.n ? `${openReports.n} open ${openReports.n === 1 ? "report" : "reports"} from customers.` : "No open reports."} Reports
            show what the customer chose to write.
          </p>
        </div>
        <Link href="/admin/support" className="rounded-lg bg-brand px-4 py-2 font-medium text-on-brand hover:bg-brand-hover">
          Open support inbox
        </Link>
      </section>

      <section className="mt-8" aria-labelledby="ref-heading">
        <h2 id="ref-heading" className="text-lg font-semibold">Find an error reference</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">The 8-character reference a customer sees on an error screen. Also search Sentry and the logs for it.</p>
        <form className="mt-2 flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1">
            <span className="font-medium">Reference</span>
            <input name="ref" defaultValue={ref} maxLength={40} className="rounded-lg border border-zinc-400 px-3 py-2 font-mono uppercase" />
          </label>
          <button type="submit" className="rounded-lg bg-brand px-4 py-2 text-on-brand hover:bg-brand-hover">Find</button>
        </form>
        {ref && (
          <div className="mt-3" role="status">
            {matches.length === 0 ? (
              <p>Nothing was saved under {ref}. The request may have failed before changing anything; check Sentry and the logs.</p>
            ) : (
              <ul className="list-disc pl-6">
                {matches.map((m, i) => (
                  <li key={i}>
                    {m.business}: {m.action.replaceAll("_", " ")} ({m.entity.replaceAll("_", " ")}) at {when(m.at)}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>

      <section className="mt-10" aria-labelledby="onboard-heading">
        <h2 id="onboard-heading" className="text-lg font-semibold">Set up a new customer</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Creates the business and a link for its owner. Send the link to them yourself: anyone who opens it can take over the business.
        </p>
        <OnboardForm />
      </section>

      <section className="mt-10" aria-labelledby="businesses-heading">
        <h2 id="businesses-heading" className="text-lg font-semibold">Businesses ({rows.length})</h2>
        {rows.length === 0 ? (
          <p className="mt-2">No businesses yet.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-3">
            {rows.map((r) => (
              <li key={r.org.id} className="rounded-lg border border-zinc-300 p-3 dark:border-zinc-700">
                <p className="font-medium">
                  {r.org.name} <span className="font-normal text-zinc-600 dark:text-zinc-400">· {kindLabel(r.org.kind, r.org.sector)}</span>
                </p>
                <p className="text-sm">
                  Set up {when(r.org.createdAt)} · Setup {r.setupDone} of {r.setupTotal} steps · {r.staff} staff, {r.logins} with a login ·{" "}
                  {r.managers} owner{r.managers === 1 ? "" : "s"} or manager{r.managers === 1 ? "" : "s"} · Last activity {when(r.lastActive)}
                </p>
                {r.link && !r.link.acceptedAt && (
                  <div className="mt-2 text-sm">
                    <p>
                      Waiting for {r.link.ownerName} ({r.link.email}) to take over.{" "}
                      {r.link.revokedAt || r.link.expiresAt < new Date() ? "Their link no longer works." : `Link works until ${when(r.link.expiresAt)}.`}
                    </p>
                    <NewOwnerLinkButton organisationId={r.org.id} />
                  </div>
                )}
                {r.link?.acceptedAt && <p className="mt-1 text-sm">Owner joined {when(r.link.acceptedAt)}.</p>}
                <p className="mt-1 text-sm">Plan: {planLine(r.org, r.staff)}</p>
                {r.org.charityNumber && !r.org.charityApproved && (
                  <div className="mt-2 text-sm">
                    <p>
                      Asked for the charity price with number <span className="font-mono">{r.org.charityNumber}</span>. Check it on the Charity
                      Commission or Companies House (CIC) register first.
                    </p>
                    <ApproveCharityButton organisationId={r.org.id} />
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

    </main>
  );
}

