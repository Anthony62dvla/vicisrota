import { addDays, ADULT_WEEKLY_LIMIT, referencePeriod, REFERENCE_WEEKS, workingTimeReport, YOUNG_WEEKLY_LIMIT, type WorkingTimeLine } from "@vicisrota/compliance";
import { schema, withOrganisation } from "@vicisrota/db";
import { and, asc, eq, gte, lte } from "drizzle-orm";
import Link from "next/link";
import { requireManager } from "@/lib/business";
import { db } from "@/lib/db";
import { todayInUk } from "@/lib/rota";
import { entryAsShift, loadConfirmedHours } from "@/lib/working-time";

const ukDate = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-GB", { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" });
const hrs = (n: number) => `${Number.isInteger(n) ? n : n.toFixed(1)} hours`;

const STATUS: Record<WorkingTimeLine["status"], { label: string; tone: string }> = {
  over: { label: "Over the limit", tone: "border-red-600" },
  close: { label: "Close to the limit", tone: "border-amber-600" },
  ok: { label: "Within the limit", tone: "border-zinc-300 dark:border-zinc-700" },
  opted_out: { label: "Opted out of the 48-hour limit", tone: "border-zinc-300 dark:border-zinc-700" },
  no_hours: { label: "No confirmed hours", tone: "border-zinc-300 dark:border-zinc-700" },
};

const explain = (l: WorkingTimeLine) => {
  if (l.young)
    return l.weeksOverYoungLimit
      ? `Under 18: worked more than ${YOUNG_WEEKLY_LIMIT} hours in ${l.weeksOverYoungLimit} week${l.weeksOverYoungLimit === 1 ? "" : "s"}. Young workers cannot opt out of this limit.`
      : `Under 18: no week over ${YOUNG_WEEKLY_LIMIT} hours. The highest was ${hrs(l.highestWeekHours)}.`;
  if (l.status === "over") return `Averages ${hrs(l.averageHours!)} a week, above ${ADULT_WEEKLY_LIMIT}. Reduce their hours, or ask whether they want to opt out in writing.`;
  if (l.status === "close") return `Averages ${hrs(l.averageHours!)} a week. Keep an eye on their hours over the coming weeks.`;
  if (l.status === "opted_out") return `Averages ${l.averageHours === null ? "no hours" : hrs(l.averageHours)} a week. Keep their signed opt-out. They can cancel it with notice.`;
  if (l.status === "no_hours") return "No hours were confirmed for them in these weeks.";
  return `Averages ${hrs(l.averageHours!)} a week.`;
};

export default async function WorkingTimePage() {
  const { organisationId } = await requireManager();
  const today = todayInUk();
  const { from, to } = referencePeriod(today);
  const { workers, entries, leave } = await withOrganisation(db, organisationId, async (tx) => ({
    workers: await tx.select().from(schema.worker).orderBy(asc(schema.worker.fullName)),
    entries: await loadConfirmedHours(tx, from, to),
    leave: await tx
      .select()
      .from(schema.leaveRequest)
      .where(and(eq(schema.leaveRequest.status, "approved"), lte(schema.leaveRequest.startsOn, to), gte(schema.leaveRequest.endsOn, from))),
  }));
  const lines = workingTimeReport({
    today,
    workers: workers.map((w) => ({
      id: w.id,
      name: w.fullName,
      dateOfBirth: w.dateOfBirth,
      optedOutOf48HourLimit: w.optedOutOf48HourLimit,
      daysPerWeek: w.daysPerWeek,
    })),
    worked: entries.map(entryAsShift),
    leave: leave.map((l) => ({ workerId: l.workerId, kind: l.kind, status: "approved" as const, startsOn: l.startsOn, endsOn: l.endsOn })),
  });
  const order = { over: 0, close: 1, ok: 2, opted_out: 3, no_hours: 4 };
  lines.sort((a, b) => order[a.status] - order[b.status]);
  const needsAction = lines.filter((l) => l.status === "over").length;

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 lg:px-8">
      <h1 className="text-2xl font-semibold">Working time records</h1>
      <p className="mt-2 text-zinc-700 dark:text-zinc-300">
        Average weekly hours over the last {REFERENCE_WEEKS} whole weeks, {ukDate(from)} to {ukDate(to)}, from confirmed hours on{" "}
        <Link href="/timesheets" className="underline">Timesheets</Link>. Holiday, sickness and family leave are left out so they do not pull the
        average down.
      </p>
      {needsAction > 0 && (
        <p role="status" className="mt-4 rounded-lg border-2 border-red-600 p-3 font-medium">
          {needsAction} {needsAction === 1 ? "person is" : "people are"} over the limit. Publishing a rota that keeps them there will be blocked.
        </p>
      )}

      {lines.length === 0 ? (
        <p className="mt-6">Add your staff first on the <Link href="/staff" className="underline">Staff page</Link>.</p>
      ) : (
        <ul className="mt-6 flex flex-col gap-3">
          {lines.map((l) => (
            <li key={l.workerId} className={`rounded-lg border-2 p-3 ${STATUS[l.status].tone}`}>
              <p className="font-medium">
                {l.name}: {STATUS[l.status].label}
              </p>
              <p>{explain(l)}</p>
              {l.excludedWeeks > 0 && <p className="text-sm text-zinc-600 dark:text-zinc-400">{l.excludedWeeks} weeks of leave or sickness left out.</p>}
              {l.status !== "no_hours" && (
                <details className="mt-2">
                  <summary className="cursor-pointer underline">Hours each week</summary>
                  <table className="mt-2 w-full max-w-sm text-sm">
                    <thead>
                      <tr className="text-left">
                        <th className="py-1 font-medium">Week starting</th>
                        <th className="py-1 font-medium">Hours</th>
                      </tr>
                    </thead>
                    <tbody>
                      {l.weeks.map((w) => (
                        <tr key={w.startsOn} className="border-t border-zinc-200 dark:border-zinc-800">
                          <td className="py-1">{ukDate(w.startsOn)}</td>
                          <td className="py-1">
                            {w.hours}
                            {w.excludedDays > 0 && ` (${w.excludedDays} day${w.excludedDays === 1 ? "" : "s"} leave or sick)`}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </details>
              )}
            </li>
          ))}
        </ul>
      )}

      <section className="mt-10" aria-labelledby="download-heading">
        <h2 id="download-heading" className="text-lg font-semibold">Download records</h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Keep working time records for 2 years. The file lists all confirmed work, with breaks and night hours (23:00 to 06:00). It also shows who has chosen to work more than 48 hours a week. Up to a year at a time.
        </p>
        <form action="/working-time/export" className="mt-3 flex flex-wrap items-end gap-4">
          <label className="flex flex-col gap-1">
            <span className="font-medium">From</span>
            <input name="from" type="date" defaultValue={from} className="rounded-lg border border-zinc-400 px-3 py-2 text-base" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-medium">To</span>
            <input name="to" type="date" defaultValue={addDays(today, -1)} className="rounded-lg border border-zinc-400 px-3 py-2 text-base" />
          </label>
          <button type="submit" className="rounded-lg bg-brand px-4 py-2 text-on-brand hover:bg-brand-hover">Download (CSV)</button>
        </form>
      </section>
    </main>
  );
}
