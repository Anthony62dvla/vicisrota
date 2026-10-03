import { withOrganisation } from "@vicisrota/db";
import Link from "next/link";
import { requireManager } from "@/lib/business";
import { db } from "@/lib/db";
import { loadLoneShifts, URGENCY } from "@/lib/lone-working";
import { AutoRefresh, DealtWithForm } from "./forms";

const timeFmt = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const dayFmt = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", weekday: "short", day: "numeric", month: "short" });

const STATE_LABEL = { help: "Asked for help", overdue: "Missed check-in", ok: "Checked in", not_started: "Not started yet", finished: "Finished safely" } as const;

export default async function LoneWorkingPage() {
  const { organisationId, businessName } = await requireManager();
  const { now, shifts } = await withOrganisation(db, organisationId, async (tx) => {
    const now = new Date().getTime();
    // Shifts from the last 12 hours to the next 12, so a missed check-out overnight still shows in the morning.
    return { now, shifts: await loadLoneShifts(tx, { from: new Date(now - 12 * 3_600_000), to: new Date(now + 12 * 3_600_000), now }) };
  });
  shifts.sort((a, b) => URGENCY[a.status.state] - URGENCY[b.status.state] || a.shift.startsAt.getTime() - b.shift.startsAt.getTime());
  const urgent = shifts.filter((s) => s.status.state === "help" || s.status.state === "overdue").length;

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-12">
      <AutoRefresh seconds={60} />
      <p>
        <Link href="/dashboard" className="underline">{businessName}</Link> · <Link href="/rota" className="underline">Rota</Link>
      </p>
      <h1 className="mt-2 text-2xl font-semibold">Lone working</h1>
      <p className="mt-1">
        People working alone check in at the start, at set times, and when they finish. Anyone who asks for help or misses a check-in by
        more than 15 minutes is shown first. This page updates every minute. Last updated {timeFmt.format(new Date(now))}.
      </p>
      {urgent > 0 && (
        <p role="alert" className="mt-4 rounded-lg border-2 border-red-600 p-3 font-medium">
          {urgent === 1 ? "1 person needs" : `${urgent} people need`} checking on now. Try to contact them. If you cannot reach someone and are
          worried, call 999.
        </p>
      )}
      {shifts.length === 0 ? (
        <p className="mt-6">Nobody is working alone in the 12 hours either side of now. Mark a shift as working alone on the rota.</p>
      ) : (
        <ul className="mt-6 flex flex-col gap-3">
          {shifts.map(({ shift, workerName, clientName, postcode, checks, status }) => {
            const urgentRow = status.state === "help" || status.state === "overdue";
            const lastOwn = checks.filter((c) => c.kind !== "resolved").at(-1);
            const lastHelp = checks.filter((c) => c.kind === "help").at(-1);
            const lastResolved = checks.filter((c) => c.kind === "resolved").at(-1);
            return (
              <li key={shift.id} className={`rounded-lg border p-4 ${urgentRow ? "border-2 border-red-600" : "border-zinc-300 dark:border-zinc-700"}`}>
                <p className="font-medium">
                  {workerName}: {STATE_LABEL[status.state]}
                </p>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  {dayFmt.format(shift.startsAt)}, {timeFmt.format(shift.startsAt)} to {timeFmt.format(shift.endsAt)}
                  {clientName && <>, visiting {clientName}{postcode && ` (${postcode})`}</>}
                </p>
                {status.state === "overdue" && <p className="mt-1">{workerName} {status.reason}, due {timeFmt.format(new Date(status.dueAt!))}.</p>}
                {status.state === "help" && lastHelp && (
                  <p className="mt-1">
                    Asked for help at {timeFmt.format(lastHelp.createdAt)}
                    {lastHelp.note && <>: &ldquo;{lastHelp.note}&rdquo;</>}
                  </p>
                )}
                {lastOwn && <p className="mt-1 text-sm">Last check-in {timeFmt.format(lastOwn.createdAt)}.</p>}
                {lastResolved && !urgentRow && (
                  <p className="mt-1 text-sm">
                    Dealt with at {timeFmt.format(lastResolved.createdAt)} by {lastResolved.actorName ?? "a manager"}: {lastResolved.note}
                  </p>
                )}
                {status.state === "ok" && status.dueAt && <p className="text-sm">Next due by {timeFmt.format(new Date(status.dueAt))}.</p>}
                {urgentRow && <DealtWithForm shiftId={shift.id} />}
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
