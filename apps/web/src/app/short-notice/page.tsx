import { schema, withOrganisation } from "@vicisrota/db";
import { desc, eq, gte } from "drizzle-orm";
import Link from "next/link";
import { requireManager } from "@/lib/business";
import { db } from "@/lib/db";
import { ShortNoticeForm, WaiveForm } from "./forms";

const dayFmt = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", weekday: "short", day: "numeric", month: "short" });
const timeFmt = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const pounds = (pence: number) => `£${(pence / 100).toFixed(2)}`;
const duration = (minutes: number) => `${Math.floor(minutes / 60)} h${minutes % 60 ? ` ${minutes % 60} min` : ""}`;
const KIND = { cancelled: "Cancelled", moved: "Moved", shortened: "Cut short" } as const;
/** Payments for shifts in the last 13 weeks and any still to come. */
const SHOWN_DAYS = 91;

export default async function ShortNoticePage() {
  const { organisationId } = await requireManager();
  const { settings, payments } = await withOrganisation(db, organisationId, async (tx) => {
    const since = new Date(new Date().getTime() - SHOWN_DAYS * 24 * 3600_000);
    return {
      settings: (
        await tx
          .select({ hours: schema.organisation.shortNoticeHours, percent: schema.organisation.shortNoticePayPercent })
          .from(schema.organisation)
          .where(eq(schema.organisation.id, organisationId))
      )[0]!,
      payments: await tx
        .select({ payment: schema.shortNoticePayment, name: schema.worker.fullName })
        .from(schema.shortNoticePayment)
        .innerJoin(schema.worker, eq(schema.worker.id, schema.shortNoticePayment.workerId))
        .where(gte(schema.shortNoticePayment.shiftStartsAt, since))
        .orderBy(desc(schema.shortNoticePayment.shiftStartsAt)),
    };
  });
  const owed = payments.filter((p) => !p.payment.waivedAt).reduce((s, p) => s + p.payment.pence, 0);

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 lg:px-8">
      <h1 className="text-2xl font-semibold">Short-notice pay</h1>
      <p className="mt-1">
        If you cancel, move or shorten someone&apos;s shift at short notice, they are paid for the time they lose. VicisRota works out the amount when you save the change. It is added to their pay for that week.
      </p>

      <section className="mt-8" aria-labelledby="settings-heading">
        <h2 id="settings-heading" className="text-lg font-semibold">Your rule</h2>
        <p className="mt-2">
          The Employment Rights Act 2025 gives workers a right to this pay. It is not law yet. The government expects it in 2027. New rules will then set the notice period and how much is paid. Until then you choose both here. Switching it on now gives your staff steadier pay and gets
          you ready early. When the regulations are published, VicisRota will be updated to match them.
        </p>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          It applies to everyone on the rota. Changes a person asks for themselves, like a swap, never count. Only changes a manager makes count.
        </p>
        <ShortNoticeForm hours={settings.hours} percent={settings.percent} />
      </section>

      <section className="mt-10" aria-labelledby="payments-heading">
        <h2 id="payments-heading" className="text-lg font-semibold">Payments</h2>
        {payments.length === 0 ? (
          <p className="mt-2">No short-notice pay in the last 13 weeks.</p>
        ) : (
          <>
            <p className="mt-2">
              {pounds(owed)} owed for shifts in the last 13 weeks and coming up. It is included in{" "}
              <Link href="/timesheets" className="underline">Timesheets and pay</Link> and the payroll file.
            </p>
            <ul className="mt-4 flex flex-col gap-3">
              {payments.map(({ payment: p, name }) => (
                <li key={p.id} className="rounded-lg border border-line p-3">
                  <p className="font-medium">
                    {name}: {pounds(p.pence)}
                    {p.waivedAt && <span className="ml-2 font-normal text-zinc-600 dark:text-zinc-400">(not owed)</span>}
                  </p>
                  <p className="text-sm">
                    {KIND[p.kind]} with {p.noticeHours} hours&apos; notice. The shift was {dayFmt.format(p.shiftStartsAt)}, {timeFmt.format(p.shiftStartsAt)} to{" "}
                    {timeFmt.format(p.shiftEndsAt)}; {duration(p.lostMinutes)} of paid time lost.
                  </p>
                  {p.waivedAt ? <p className="mt-1 text-sm">Reason it is not owed: {p.waivedReason}</p> : <WaiveForm id={p.id} name={name} />}
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </main>
  );
}
