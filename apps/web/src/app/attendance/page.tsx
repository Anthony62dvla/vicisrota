import type { AttendanceState } from "@vicisrota/compliance";
import { schema, withOrganisation } from "@vicisrota/db";
import { eq } from "drizzle-orm";
import Link from "next/link";
import { ATTENDANCE_ORDER, loadAttendance, todayWindow, type AttendanceRow } from "@/lib/attendance";
import { requireManager } from "@/lib/business";
import { db } from "@/lib/db";
import { smsConfigured } from "@/lib/sms";
import { AutoRefresh } from "../lone-working/forms";
import { LateAlertsForm } from "./forms";

const timeFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/London",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});
const time = (d: Date | number) => timeFmt.format(typeof d === "number" ? new Date(d) : d);
const mins = (n: number) => (n >= 60 ? `${Math.floor(n / 60)} h ${n % 60} min` : `${n} min`);

const LABEL: Record<AttendanceState, string> = {
  late: "Not clocked in",
  missed: "Did not clock in",
  starting: "Starting now",
  in: "Clocked in",
  on_break: "On a break",
  upcoming: "Later today",
  on_leave: "On leave or off sick",
  finished: "Finished",
};

export default async function AttendancePage() {
  const { organisationId, businessName } = await requireManager();
  const { now, rows, lateAlertMinutes, contacts } = await withOrganisation(db, organisationId, async (tx) => {
    const now = new Date().getTime();
    return {
      now,
      rows: await loadAttendance(tx, { ...todayWindow(now), now }),
      lateAlertMinutes:
        (await tx.select({ m: schema.organisation.lateAlertMinutes }).from(schema.organisation).where(eq(schema.organisation.id, organisationId)))[0]
          ?.m ?? null,
      contacts: (await tx.select({ id: schema.alertContact.id }).from(schema.alertContact).where(eq(schema.alertContact.active, true))).length,
    };
  });
  rows.sort((a, b) => ATTENDANCE_ORDER[a.state] - ATTENDANCE_ORDER[b.state] || a.shift.startsAt.getTime() - b.shift.startsAt.getTime());
  const late = rows.filter((r) => r.state === "late").length;
  const working = rows.filter((r) => r.state === "in" || r.state === "on_break").length;

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-12">
      <AutoRefresh seconds={60} />
      <p>
        <Link href="/dashboard" className="underline">
          {businessName}
        </Link>{" "}
        ·{" "}
        <Link href="/rota" className="underline">
          Rota
        </Link>{" "}
        ·{" "}
        <Link href="/timesheets" className="underline">
          Timesheets
        </Link>
      </p>
      <h1 className="mt-2 text-2xl font-semibold">Today</h1>
      <p className="mt-1">
        Who is working today and whether they have clocked in. People who have not clocked in are shown first. This page updates every minute. Last
        updated {time(now)}.
      </p>

      <p className="mt-4 font-medium" role="status">
        {working === 1 ? "1 person is" : `${working} people are`} working now
        {late > 0 && `, ${late === 1 ? "1 person has" : `${late} people have`} not clocked in`}.
      </p>

      {rows.length === 0 ? (
        <p className="mt-6">Nobody is on a published shift today.</p>
      ) : (
        <ul className="mt-4 flex flex-col gap-3">
          {rows.map((r) => (
            <AttendanceItem key={r.shift.id} row={r} />
          ))}
        </ul>
      )}

      <section className="mt-10" aria-labelledby="alerts-heading">
        <h2 id="alerts-heading" className="text-lg font-semibold">
          Late texts
        </h2>
        <p className="mt-1">
          VicisRota can text your alert contacts when someone has not clocked in for a shift, so a gap is noticed before it matters. In care, that can
          be a missed visit. Each shift is texted about once. Only turn this on if your staff clock in, from their phone or the tablet at work.
        </p>
        {contacts === 0 && (
          <p className="mt-2 rounded-lg border border-amber-500 p-3">
            You have no alert contacts yet, so no texts would be sent. Add them on the{" "}
            <Link href="/lone-working" className="underline">
              Lone working page
            </Link>
            .
          </p>
        )}
        {!smsConfigured() && (
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">Texts are not switched on yet, so they are only written to the log.</p>
        )}
        <LateAlertsForm minutes={lateAlertMinutes} />
      </section>
    </main>
  );
}

function AttendanceItem({ row: r }: { row: AttendanceRow }) {
  const urgent = r.state === "late" || r.state === "missed";
  const detail = [
    `${time(r.shift.startsAt)} to ${time(r.shift.endsAt)}`,
    r.roleName,
    r.place,
    r.state === "late" && `${mins(r.minutesLate)} after the start`,
    r.clockedIn !== null && `in at ${time(r.clockedIn)}${r.minutesLate > 5 ? `, ${mins(r.minutesLate)} late` : ""}`,
    r.clockedOut !== null && `out at ${time(r.clockedOut)}`,
  ].filter(Boolean);
  return (
    <li
      className={`rounded-lg border p-4 ${urgent ? "border-2 border-red-600" : r.state === "in" || r.state === "on_break" ? "border-brand" : "border-zinc-300 dark:border-zinc-700"}`}
    >
      <p className="font-medium">
        {r.workerName}: {LABEL[r.state]}
      </p>
      <p className="text-sm">{detail.join(" · ")}</p>
      {urgent && (
        <p className="mt-1 text-sm">
          Contact them, or find cover on the{" "}
          <Link href="/rota" className="underline">
            rota
          </Link>
          . If they clocked in on paper, add their hours on{" "}
          <Link href="/timesheets" className="underline">
            Timesheets
          </Link>
          .
        </p>
      )}
    </li>
  );
}
