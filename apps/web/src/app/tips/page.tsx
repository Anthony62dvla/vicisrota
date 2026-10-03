import { addDays, allocateTips, defaultTippingPolicy, TIP_RECORD_YEARS } from "@vicisrota/compliance";
import { schema, withOrganisation } from "@vicisrota/db";
import { and, asc, desc, eq, gte, isNull, lte } from "drizzle-orm";
import Link from "next/link";
import { requireManager } from "@/lib/business";
import { db } from "@/lib/db";
import { loadPayroll } from "@/lib/payroll";
import { todayInUk } from "@/lib/rota";
import { parsePeriod } from "../timesheets/period";
import { markTipsPaid, removeTip } from "./actions";
import { PolicyForm, RecordTipForm, ShareTipsForm } from "./forms";

const pounds = (pence: number) => `£${(pence / 100).toFixed(2)}`;
const ukDate = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-GB", { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" });
const SOURCE = { card: "Card", cash: "Cash", service_charge: "Service charge" } as const;

/** First and last day of the month containing a date. */
const monthOf = (d: string) => {
  const first = `${d.slice(0, 7)}-01`;
  const [y, m] = d.split("-").map(Number) as [number, number];
  const next = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
  return { from: first, to: addDays(next, -1) };
};

export default async function TipsPage({ searchParams }: PageProps<"/tips">) {
  const { organisationId, businessName } = await requireManager();
  const query = await searchParams;
  const today = todayInUk();
  const asked = parsePeriod(typeof query.from === "string" ? query.from : null, typeof query.to === "string" ? query.to : null);
  const { from, to } = "error" in asked ? monthOf(today) : asked;

  const data = await withOrganisation(db, organisationId, async (tx) => ({
    tips: await tx
      .select()
      .from(schema.tip)
      .where(and(gte(schema.tip.receivedOn, from), lte(schema.tip.receivedOn, to)))
      .orderBy(asc(schema.tip.receivedOn)),
    unsharedTotal: (
      await tx.select().from(schema.tip).where(and(isNull(schema.tip.allocationId), gte(schema.tip.receivedOn, from), lte(schema.tip.receivedOn, to)))
    ).reduce((s, t) => s + t.amountPence, 0),
    payroll: await loadPayroll(tx, organisationId, from, to),
    allocations: await tx.select().from(schema.tipAllocation).orderBy(desc(schema.tipAllocation.createdAt)).limit(12),
    shares: await tx
      .select({ allocationId: schema.tipShare.allocationId, name: schema.worker.fullName, hours: schema.tipShare.hours, pence: schema.tipShare.pence })
      .from(schema.tipShare)
      .innerJoin(schema.worker, eq(schema.tipShare.workerId, schema.worker.id))
      .orderBy(asc(schema.worker.fullName)),
    policy: (await tx.select({ policy: schema.organisation.tippingPolicy }).from(schema.organisation).where(eq(schema.organisation.id, organisationId)))[0]?.policy,
  }));
  const names = new Map(data.payroll.lines.map((l) => [l.workerId, l.name]));
  const preview = allocateTips(data.unsharedTotal, data.payroll.lines.map((l) => ({ workerId: l.workerId, hours: l.hours + l.travelHours })));
  const overdue = data.allocations.filter((a) => !a.paidAt && a.payBy < today);

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-12">
      <p>
        <Link href="/dashboard" className="underline">{businessName}</Link> · <Link href="/timesheets" className="underline">Timesheets</Link>
      </p>
      <h1 className="mt-2 text-2xl font-semibold">Tips</h1>
      <p className="mt-1">
        By law, all tips and service charges go to staff, shared fairly and paid by the end of the following month. Records are kept for{" "}
        {TIP_RECORD_YEARS} years.
      </p>
      {!data.policy && (
        <p role="alert" className="mt-4 rounded-lg border border-amber-500 p-3">
          You need a written tipping policy that staff can read. A starting version is below for you to check and save.
        </p>
      )}
      {overdue.length > 0 && (
        <p role="alert" className="mt-4 rounded-lg border border-red-500 p-3">
          {overdue.length} tip {overdue.length === 1 ? "share is" : "shares are"} past the legal deadline and not marked as paid.
        </p>
      )}

      <form className="mt-6 flex flex-wrap items-end gap-3" aria-label="Period">
        <label className="flex flex-col gap-1">
          <span className="font-medium">From</span>
          <input name="from" type="date" defaultValue={from} className="rounded-lg border border-zinc-400 px-3 py-2" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-medium">To</span>
          <input name="to" type="date" defaultValue={to} className="rounded-lg border border-zinc-400 px-3 py-2" />
        </label>
        <button type="submit" className="rounded-lg border border-zinc-400 px-4 py-2">Show period</button>
      </form>

      <section className="mt-8" aria-labelledby="received-heading">
        <h2 id="received-heading" className="text-lg font-semibold">Tips received, {ukDate(from)} to {ukDate(to)}</h2>
        {data.tips.length === 0 ? (
          <p className="mt-2">No tips recorded in this period.</p>
        ) : (
          <ul className="mt-2 flex flex-col gap-2">
            {data.tips.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-3 rounded-lg border border-zinc-300 p-3 dark:border-zinc-700">
                <span>
                  {ukDate(t.receivedOn)} · {SOURCE[t.source]} · <strong>{pounds(t.amountPence)}</strong>
                  {t.note && ` · ${t.note}`}
                  {t.allocationId && " · shared"}
                </span>
                {!t.allocationId && (
                  <form action={removeTip}>
                    <input type="hidden" name="id" value={t.id} />
                    <button type="submit" className="text-sm underline">Remove</button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}
        <RecordTipForm today={today} />
      </section>

      <section className="mt-10" aria-labelledby="share-heading">
        <h2 id="share-heading" className="text-lg font-semibold">Share out</h2>
        {data.unsharedTotal === 0 ? (
          <p className="mt-2">Nothing waiting to be shared in this period.</p>
        ) : preview.length === 0 ? (
          <p className="mt-2">
            {pounds(data.unsharedTotal)} is waiting, but nobody has confirmed hours in this period. <Link href={`/timesheets?from=${from}&to=${to}`} className="underline">Confirm timesheets</Link> first.
          </p>
        ) : (
          <>
            <p className="mt-2">
              {pounds(data.unsharedTotal)} is waiting to be shared. By hours worked, that would be:
            </p>
            <table className="mt-2 w-full text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-300 dark:border-zinc-700">
                  <th className="py-2">Name</th>
                  <th className="py-2">Hours</th>
                  <th className="py-2">Share</th>
                </tr>
              </thead>
              <tbody>
                {preview.map((p) => (
                  <tr key={p.workerId} className="border-b border-zinc-200 dark:border-zinc-800">
                    <td className="py-2">{names.get(p.workerId)}</td>
                    <td className="py-2">{p.hours}</td>
                    <td className="py-2">{pounds(p.pence)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {data.payroll.unconfirmed > 0 && (
              <p className="mt-2 text-sm">
                {data.payroll.unconfirmed} worked shift{data.payroll.unconfirmed === 1 ? " has" : "s have"} no confirmed hours and {data.payroll.unconfirmed === 1 ? "is" : "are"} not counted.
              </p>
            )}
            <ShareTipsForm from={from} to={to} label={`Share ${pounds(data.unsharedTotal)}`} />
          </>
        )}
      </section>

      <section className="mt-10" aria-labelledby="history-heading">
        <h2 id="history-heading" className="text-lg font-semibold">Shared tips</h2>
        {data.allocations.length === 0 ? (
          <p className="mt-2">No tips shared yet.</p>
        ) : (
          <ul className="mt-2 flex flex-col gap-2">
            {data.allocations.map((a) => (
              <li key={a.id} className={`rounded-lg border p-3 ${!a.paidAt && a.payBy < today ? "border-red-500" : "border-zinc-300 dark:border-zinc-700"}`}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span>
                    {ukDate(a.periodFrom)} to {ukDate(a.periodTo)} · <strong>{pounds(a.totalPence)}</strong> ·{" "}
                    {a.paidAt ? `paid ${a.paidAt.toLocaleDateString("en-GB", { timeZone: "Europe/London" })}` : `pay by ${ukDate(a.payBy)}`}
                  </span>
                  {!a.paidAt && (
                    <form action={markTipsPaid}>
                      <input type="hidden" name="id" value={a.id} />
                      <button type="submit" className="rounded-lg border border-zinc-400 px-3 py-1 text-sm">Mark as paid</button>
                    </form>
                  )}
                </div>
                <details className="mt-1">
                  <summary className="cursor-pointer text-sm underline">Who got what</summary>
                  <ul className="mt-1 text-sm">
                    {data.shares
                      .filter((s) => s.allocationId === a.id)
                      .map((s, i) => (
                        <li key={i}>{s.name}: {pounds(s.pence)} ({s.hours} hours)</li>
                      ))}
                  </ul>
                </details>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-10" aria-labelledby="policy-heading">
        <h2 id="policy-heading" className="text-lg font-semibold">Tipping policy</h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Staff see this on their own page. Check it matches how you actually share tips.</p>
        <PolicyForm policy={data.policy ?? defaultTippingPolicy(businessName)} />
      </section>
    </main>
  );
}
