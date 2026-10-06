import { addDays, DEFAULT_PAY_ITEM_NAMES, londonParts, PAY_ITEMS } from "@vicisrota/compliance";
import { schema, withOrganisation } from "@vicisrota/db";
import { and, asc, desc, eq, gte, inArray, lt } from "drizzle-orm";
import Link from "next/link";
import { requireManager } from "@/lib/business";
import { db } from "@/lib/db";
import { clockSummaries } from "@/lib/clock";
import { loadPayroll, periodBounds } from "@/lib/payroll";
import { todayInUk } from "@/lib/rota";
import { PayItemNamesForm, SendToXeroForm, SleepInPayForm, TimesheetList, type Row } from "./forms";
import { disconnectXero } from "./actions";
import { xeroConfigured } from "@/lib/xero";
import { parsePeriod } from "./period";

const MINUTE = 60_000;
const timeFmt = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const ukDate = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-GB", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" });
const pounds = (pence: number) => `£${(pence / 100).toFixed(2)}`;
const hoursText = (h: number) => `${Number.isInteger(h) ? h : h.toFixed(2).replace(/0$/, "")} hours`;

export default async function TimesheetsPage({ searchParams }: PageProps<"/timesheets">) {
  const { organisationId, sector } = await requireManager();
  const query = await searchParams;
  const today = todayInUk();
  const asked = parsePeriod(typeof query.from === "string" ? query.from : null, typeof query.to === "string" ? query.to : null, today);
  const error = "error" in asked ? asked.error : null;
  const { from, to } = "error" in asked ? (parsePeriod(null, null, today) as { from: string; to: string }) : asked;
  const { start, end } = periodBounds(from, to);

  const xeroStatus = typeof query.xero === "string" ? query.xero : null;
  const [xero] = await withOrganisation(db, organisationId, (tx) =>
    tx.select({ tenantName: schema.xeroConnection.tenantName, lastSentAt: schema.xeroConnection.lastSentAt }).from(schema.xeroConnection),
  );
  const data = await withOrganisation(db, organisationId, async (tx) => {
    const shifts = await tx
      .select({ shift: schema.shift, name: schema.worker.fullName })
      .from(schema.shift)
      .innerJoin(schema.worker, eq(schema.shift.workerId, schema.worker.id))
      .where(and(eq(schema.shift.status, "published"), gte(schema.shift.startsAt, start), lt(schema.shift.startsAt, end), lt(schema.shift.startsAt, new Date())))
      .orderBy(asc(schema.shift.startsAt), asc(schema.worker.fullName));
    const ids = shifts.map((s) => s.shift.id);
    const [entries, breaks] = ids.length
      ? await Promise.all([
          tx.select().from(schema.timeEntry).where(inArray(schema.timeEntry.shiftId, ids)),
          tx.select().from(schema.shiftBreak).where(inArray(schema.shiftBreak.shiftId, ids)),
        ])
      : [[], []];
    return {
      shifts,
      clocks: await clockSummaries(tx, shifts.map((s) => s.shift), new Date().getTime()),
      entries,
      breaks,
      payroll: await loadPayroll(tx, organisationId, from, to),
      exports: await tx.select().from(schema.payrollExport).orderBy(desc(schema.payrollExport.createdAt)).limit(5),
      payItemNames: (await tx.select({ names: schema.organisation.payItemNames }).from(schema.organisation).where(eq(schema.organisation.id, organisationId)))[0]?.names ?? {},
    };
  });

  const rows: Row[] = data.shifts.map(({ shift, name }) => {
    const rosteredBreak = Math.round(
      data.breaks.filter((b) => b.shiftId === shift.id).reduce((s, b) => s + (b.endsAt.getTime() - b.startsAt.getTime()), 0) / MINUTE,
    );
    const entry = data.entries.find((e) => e.shiftId === shift.id);
    const clocked = data.clocks.find((c) => c.shift.id === shift.id)!;
    const clock = clocked.summary;
    const awayEvent = clocked.events.find((e) => e.place === "away");
    const unknownIn = clocked.events.find((e) => e.kind === "in" && e.place === "unknown");
    const how = clocked.events.some((e) => e.source === "kiosk")
      ? " on the in-store tablet"
      : clocked.events.some((e) => e.source === "qr")
        ? " by scanning the tablet's code"
        : "";
    const worked = entry ? (entry.endsAt.getTime() - entry.startsAt.getTime()) / 3_600_000 - entry.breakMinutes / 60 : 0;
    return {
      shiftId: shift.id,
      name,
      day: ukDate(londonParts(shift.startsAt.getTime()).date),
      rostered: `${timeFmt.format(shift.startsAt)}–${timeFmt.format(shift.endsAt)}`,
      rosteredBreak,
      sleepIn: shift.kind === "sleep_in",
      defaults: { start: timeFmt.format(shift.startsAt), end: timeFmt.format(shift.endsAt), breakMinutes: rosteredBreak },
      clocked:
        clock.clockedIn === null
          ? undefined
          : {
              text:
                clock.clockedOut === null
                  ? `Clocked in ${timeFmt.format(new Date(clock.clockedIn))}, not clocked out yet`
                  : `Clocked ${timeFmt.format(new Date(clock.clockedIn))}–${timeFmt.format(new Date(clock.clockedOut))}${clock.breakMinutes ? `, ${clock.breakMinutes} min break` : ""}${how}`,
              flags: [
                clock.lateMinutes > 5 && `${clock.lateMinutes} min late`,
                clock.leftEarlyMinutes > 5 && `left ${clock.leftEarlyMinutes} min early`,
                clock.stayedLateMinutes > 5 && `stayed ${clock.stayedLateMinutes} min late`,
                awayEvent && `phone was ${awayEvent.distanceMetres! < 1000 ? `${awayEvent.distanceMetres} m` : `${(awayEvent.distanceMetres! / 1000).toFixed(1)} km`} from work at ${awayEvent.kind === "in" ? "clock-in" : awayEvent.kind === "out" ? "clock-out" : "a break"}`,
                unknownIn && "location not shared at clock-in",
              ].filter((f): f is string => !!f),
              complete: clock.clockedOut !== null,
            },
      confirmed: entry && {
        entryId: entry.id,
        times: `${timeFmt.format(entry.startsAt)}–${timeFmt.format(entry.endsAt)}`,
        start: timeFmt.format(entry.startsAt),
        end: timeFmt.format(entry.endsAt),
        breakMinutes: entry.breakMinutes,
        awakeMinutes: entry.awakeMinutes,
        hours: hoursText(Math.round(worked * 100) / 100),
        differs:
          entry.startsAt.getTime() !== shift.startsAt.getTime() || entry.endsAt.getTime() !== shift.endsAt.getTime() || entry.breakMinutes !== rosteredBreak,
        note: entry.note,
      },
    };
  });
  const { lines, unconfirmed, sspPence, shortNoticePence, sleepInPence, holidayPay } = data.payroll;
  const care = sector === "care";
  const missingIds = lines.filter((l) => !data.payroll.payrollIds.get(l.workerId));
  const total = lines.reduce((s, l) => s + l.grossPence + (shortNoticePence.get(l.workerId) ?? 0), 0);
  const hasTravel = lines.some((l) => l.travelHours > 0);
  const query$ = `from=${from}&to=${to}`;

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8 lg:px-8">
      <h1 className="text-2xl font-semibold">Timesheets and pay</h1>
      <p className="mt-1">
        Confirm the hours people actually worked. Pay is worked out from confirmed hours, not the rota. Clock times are never rounded, so
        nobody loses pay for minutes they worked.
      </p>

      <form className="mt-6 flex flex-wrap items-end gap-3" aria-label="Pay period">
        <label className="flex flex-col gap-1">
          <span className="font-medium">From</span>
          <input name="from" type="date" defaultValue={from} className="rounded-lg border border-zinc-400 px-3 py-2" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-medium">To</span>
          <input name="to" type="date" defaultValue={to} className="rounded-lg border border-zinc-400 px-3 py-2" />
        </label>
        <button type="submit" className="rounded-lg border border-zinc-400 px-4 py-2">Show period</button>
        <Link href={`/timesheets?from=${addDays(from, -7)}&to=${addDays(from, -1)}`} className="py-2 underline">Previous week</Link>
      </form>
      {error && <p role="alert" className="mt-3 rounded-lg border border-red-400 p-3">{error} Showing this week instead.</p>}

      <section className="mt-8" aria-labelledby="hours-heading">
        <h2 id="hours-heading" className="text-lg font-semibold">Hours worked, {ukDate(from)} to {ukDate(to)}</h2>
        {rows.length === 0 ? (
          <p className="mt-2">No published shifts have been worked in this period yet.</p>
        ) : (
          <TimesheetList rows={rows} />
        )}
      </section>

      {(xeroConfigured() || xero) && (
        <section className="mt-8 rounded-lg border border-zinc-300 p-4 dark:border-zinc-700" aria-labelledby="xero-heading">
          <h2 id="xero-heading" className="text-lg font-semibold">Xero Payroll</h2>
          {xeroStatus === "connected" && <p role="status" className="mt-2 rounded-lg border border-green-600 p-3">Xero is connected.</p>}
          {xeroStatus === "failed" && <p role="alert" className="mt-2 rounded-lg border border-red-400 p-3">Xero could not be connected. Please try again.</p>}
          {xero ? (
            <>
              <p className="mt-1">
                Connected to {xero.tenantName}
                {xero.lastSentAt ? `. Hours last sent ${xero.lastSentAt.toLocaleString("en-GB", { timeZone: "Europe/London", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}` : ""}. Send
                confirmed hours as draft timesheets from Pay for this period below. People are matched by their payroll ID (use their Xero employee ID) or by name.
              </p>
              <form action={disconnectXero} className="mt-2">
                <button type="submit" className="underline">Disconnect Xero</button>
              </form>
            </>
          ) : (
            <>
              <p className="mt-1">Send confirmed hours straight to Xero Payroll as draft timesheets, instead of downloading a file.</p>
              <a href="/api/xero/connect" className="mt-2 inline-block rounded-lg border-2 border-brand px-4 py-2 font-medium text-heading">Connect Xero</a>
            </>
          )}
        </section>
      )}

      <section className="mt-10" aria-labelledby="pay-heading">
        <h2 id="pay-heading" className="text-lg font-semibold">Pay for this period</h2>
        {unconfirmed > 0 && (
          <p role="alert" className="mt-2 rounded-lg border border-amber-500 p-3">
            {unconfirmed} worked shift{unconfirmed === 1 ? " has" : "s have"} no confirmed hours, so {unconfirmed === 1 ? "it is" : "they are"} not included below.
          </p>
        )}
        {holidayPay.size > 0 && (
          <p className="mt-2 text-sm text-muted">
            Holiday pay is the average weekly pay over the last 52 paid weeks, as the law requires, and is paid on top of the gross pay below. Pay
            from before someone used VicisRota is not included, so check it for people who joined with history elsewhere.
          </p>
        )}
        {lines.length === 0 ? (
          <p className="mt-2">No confirmed hours or leave in this period.</p>
        ) : (
          <>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="border-b border-zinc-300 dark:border-zinc-700">
                    <th className="py-2">Name</th>
                    <th className="py-2">Hours</th>
                    {hasTravel && <th className="py-2">Travel</th>}
                    <th className="py-2">Rate</th>
                    <th className="py-2">Gross pay</th>
                    <th className="py-2">Holiday built up</th>
                    <th className="py-2">Leave</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l) => (
                    <tr key={l.workerId} className="border-b border-zinc-200 align-top dark:border-zinc-800">
                      <td className="py-2">
                        {l.name}
                        {l.findings.map((f, i) => (
                          <p key={i} className="mt-1 font-semibold text-red-700 dark:text-red-400">{f.message}</p>
                        ))}
                      </td>
                      <td className="py-2">{l.hours}</td>
                      {hasTravel && <td className="py-2">{l.travelHours} hours</td>}
                      <td className="py-2">{l.ratesPence.map(pounds).join(" / ") || "None"}</td>
                      <td className="py-2">
                        {pounds(l.grossPence)}
                        {l.sleepIns > 0 && (
                          <p className="mt-1">
                            including {l.sleepIns} sleep-in{l.sleepIns === 1 ? "" : "s"}
                            {l.sleepInPence ? ` (${pounds(l.sleepInPence)})` : ""}
                            {l.sleepInAwakeHours > 0 && ` and ${l.sleepInAwakeHours} hours woken to work`}
                          </p>
                        )}
                        {shortNoticePence.has(l.workerId) && (
                          <p className="mt-1">
                            plus <Link href="/short-notice" className="underline">{pounds(shortNoticePence.get(l.workerId)!)} short-notice pay</Link>
                          </p>
                        )}
                      </td>
                      <td className="py-2">{l.holidayHoursAccrued === null ? "n/a" : `${l.holidayHoursAccrued} hours`}</td>
                      <td className="py-2">
                        {[
                          l.holidayDays && `${l.holidayDays} holiday days`,
                          l.holidayHours && `${l.holidayHours} holiday hours`,
                          holidayPay.has(l.workerId) &&
                            (holidayPay.get(l.workerId)!.pence == null
                              ? "holiday pay: no pay history yet"
                              : `holiday pay ${pounds(holidayPay.get(l.workerId)!.pence!)} (average of ${holidayPay.get(l.workerId)!.weeksUsed} paid week${holidayPay.get(l.workerId)!.weeksUsed === 1 ? "" : "s"})`),
                          l.sickDays && `${l.sickDays} sick day${l.sickDays === 1 ? "" : "s"}${sspPence.has(l.workerId) ? ` (SSP ${pounds(sspPence.get(l.workerId)!)})` : ""}`,
                          l.otherLeaveDays && `${l.otherLeaveDays} other leave days`,
                        ]
                          .filter(Boolean)
                          .join(", ") || "None"}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <th className="py-2" colSpan={hasTravel ? 4 : 3}>Total gross pay{shortNoticePence.size > 0 && ", including short-notice pay"}</th>
                    <td className="py-2 font-semibold">{pounds(total)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <a href={`/timesheets/export?${query$}`} className="mt-4 inline-block rounded-lg bg-brand px-4 py-2 text-on-brand hover:bg-brand-hover">
              Download payroll file (CSV)
            </a>
            {xero && <SendToXeroForm from={from} to={to} tenantName={xero.tenantName} />}
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              Opens in Excel or Google Sheets and can be imported into most payroll software. Sick days are calendar days. Statutory
              Sick Pay is worked out on the <Link href="/sickness" className="underline">Sickness page</Link> from the days each person
              normally works; sickness that began before 6 April 2026 is not included.
            </p>
          </>
        )}
        {lines.length > 0 && (
          <div className="mt-8">
            <h3 id="send-heading" className="font-semibold">Send to your payroll software</h3>
            <p className="mt-1">
              The pay items file has one line per person for each kind of pay, with their payroll ID. Most payroll software, such as BrightPay, Sage,
              Xero or QuickBooks, can import a file like this once you match its columns the first time. Holiday is sent with its pay worked out on the
              legal 52-week average: the average of the last 52 weeks the person was paid, from hours confirmed in VicisRota. If someone has
              no pay history here yet, holiday is sent as time only, for your payroll software to work out.
            </p>
            {missingIds.length > 0 && (
              <p role="alert" className="mt-3 rounded-lg border border-amber-500 p-3">
                Add a payroll ID for {missingIds.map((l, i) => (
                  <span key={l.workerId}>
                    {i > 0 && (i === missingIds.length - 1 ? " and " : ", ")}
                    <Link href={`/staff/${l.workerId}#payroll`} className="underline">{l.name}</Link>
                  </span>
                ))}{" "}
                so their pay lands on the right person. It is the employee number in your payroll software.
              </p>
            )}
            <a href={`/timesheets/pay-items?${query$}`} className="mt-3 inline-block rounded-lg bg-brand px-4 py-2 text-on-brand hover:bg-brand-hover">
              Download pay items file (CSV)
            </a>
            <details className="mt-3">
              <summary className="cursor-pointer underline">Use your payroll software&apos;s names for each kind of pay</summary>
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                If your payroll software calls basic pay something else, for example &quot;Hourly&quot;, type its name here so the import matches. Leave a box empty
                to use the name shown.
              </p>
              <PayItemNamesForm items={PAY_ITEMS.map((item) => ({ item, standard: DEFAULT_PAY_ITEM_NAMES[item], name: data.payItemNames[item] ?? "" }))} />
            </details>
          </div>
        )}
        {care && (
          <div className="mt-8">
            <h3 className="font-semibold">Sleep-ins</h3>
            <p className="mt-1">
              On a sleep-in, the person sleeps at work and is woken only if needed. The law says sleeping time does not count for the minimum wage, but
              any time woken to work does, so that time is paid at their hourly rate on top of your sleep-in payment. Waking nights are paid by the
              hour like any other shift. The whole sleep-in still counts as working time for rest breaks and the 48-hour week.
            </p>
            <SleepInPayForm pence={sleepInPence} />
          </div>
        )}
        {data.exports.length > 0 && (
          <div className="mt-6">
            <h3 className="font-semibold">Recent exports</h3>
            <ul className="mt-2 list-disc pl-6 text-sm">
              {data.exports.map((e) => (
                <li key={e.id}>
                  {ukDate(e.periodFrom)} to {ukDate(e.periodTo)}: {e.lineCount} people, {pounds(e.totalPence)}
                  {e.flaggedCount > 0 && `, ${e.flaggedCount} flagged`} · exported {e.createdAt.toLocaleString("en-GB", { timeZone: "Europe/London" })}
                  {e.requestId && ` · reference ${e.requestId}`}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </main>
  );
}
