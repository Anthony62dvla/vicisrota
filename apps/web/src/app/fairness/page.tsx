import { addDays, fairnessReport, FAIRNESS_SHORT_NOTICE_HOURS } from "@vicisrota/compliance";
import { schema, withOrganisation } from "@vicisrota/db";
import { and, asc, eq, gte, inArray, lt } from "drizzle-orm";
import Link from "next/link";
import { requireManager } from "@/lib/business";
import { db } from "@/lib/db";
import { periodBounds } from "@/lib/payroll";
import { todayInUk } from "@/lib/rota";

const PERIODS = [4, 12, 26] as const;
const ukDate = (d: string) =>
  new Date(`${d}T12:00:00Z`).toLocaleDateString("en-GB", {
    timeZone: "UTC",
    day: "numeric",
    month: "short",
    year: "numeric",
  });

/**
 * How weekends, nights and short-notice changes are shared out across the team. Managers only, never
 * shown to staff, and never a ranking: it is there so nobody quietly ends up with more than their share.
 */
export default async function FairnessPage({ searchParams }: PageProps<"/fairness">) {
  const { organisationId } = await requireManager();
  const asked = Number((await searchParams).weeks);
  const weeks = (PERIODS as readonly number[]).includes(asked) ? asked : 12;
  const to = todayInUk();
  const from = addDays(to, -7 * weeks + 1);
  const { start, end } = periodBounds(from, to);

  const { workers, shifts, breaks, changes } = await withOrganisation(db, organisationId, async (tx) => {
    const shifts = await tx
      .select()
      .from(schema.shift)
      .where(and(eq(schema.shift.status, "published"), gte(schema.shift.startsAt, start), lt(schema.shift.startsAt, end)));
    return {
      shifts,
      breaks: shifts.length ? await tx.select().from(schema.shiftBreak).where(inArray(schema.shiftBreak.shiftId, shifts.map((s) => s.id))) : [],
      workers: await tx.select().from(schema.worker).orderBy(asc(schema.worker.fullName)),
      changes: await tx
        .select({
          workerId: schema.rotaNotice.workerId,
          noticeHours: schema.rotaNotice.noticeHours,
        })
        .from(schema.rotaNotice)
        .where(and(inArray(schema.rotaNotice.kind, ["cancelled", "changed"]), gte(schema.rotaNotice.startsAt, start), lt(schema.rotaNotice.startsAt, end))),
    };
  });
  const lines = fairnessReport({
    workers: workers.map((w) => ({
      id: w.id,
      name: w.fullName,
      dateOfBirth: w.dateOfBirth,
    })),
    shifts: shifts
      .filter((s) => s.workerId)
      .map((s) => ({
        id: s.id,
        workerId: s.workerId!,
        start: s.startsAt.toISOString(),
        end: s.endsAt.toISOString(),
        breaks: breaks
          .filter((b) => b.shiftId === s.id)
          .map((b) => ({
            start: b.startsAt.toISOString(),
            end: b.endsAt.toISOString(),
          })),
      })),
    changes,
  }).filter((l) => l.shifts > 0 || l.shortNoticeChanges > 0);
  const adjusted = new Set(workers.filter((w) => w.adjustments.maxShiftHours || w.adjustments.earliestStart || w.adjustments.latestFinish).map((w) => w.id));

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8 lg:px-8">
      <h1 className="text-2xl font-semibold">Fair shares</h1>
      <p className="mt-2 max-w-2xl">
        How weekends, nights and short-notice changes have been shared out, so nobody quietly ends up with more than their share. It is not a ranking, and staff
        never see it. A difference can have a good reason, such as someone&apos;s own choice or an agreed adjustment.
      </p>
      <nav aria-label="Period" className="mt-4 flex flex-wrap gap-2">
        {PERIODS.map((p) => (
          <Link
            key={p}
            href={`/fairness?weeks=${p}`}
            aria-current={p === weeks ? "page" : undefined}
            className={`rounded-lg border px-3 py-1 ${p === weeks ? "border-brand bg-brand-soft font-medium" : "border-zinc-400"}`}
          >
            Last {p} weeks
          </Link>
        ))}
      </nav>
      <p className="mt-3 text-sm text-muted">
        Published shifts from {ukDate(from)} to {ukDate(to)}. A night shift has at least 3 hours between 11pm and 6am. A short-notice change is a shift you
        changed or cancelled with less than {FAIRNESS_SHORT_NOTICE_HOURS / 24} days&apos; notice.
      </p>
      {lines.length === 0 ? (
        <p className="mt-6">No published shifts in these weeks yet.</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-300 dark:border-zinc-700">
                <th className="py-2">Name</th>
                <th className="py-2">Shifts</th>
                <th className="py-2">Hours</th>
                <th className="py-2">Weekend shifts</th>
                <th className="py-2">Night shifts</th>
                <th className="py-2">Short-notice changes</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l) => (
                <tr key={l.workerId} className="border-b border-zinc-200 align-top dark:border-zinc-800">
                  <td className="py-2">
                    <Link href={`/staff/${l.workerId}`} className="underline">
                      {l.name}
                    </Link>
                    {l.notes.map((n, i) => (
                      <p key={i} className="mt-1 font-medium text-amber-800 dark:text-amber-300">
                        {n}
                      </p>
                    ))}
                    {adjusted.has(l.workerId) && <p className="mt-1 text-muted">Has agreed adjustments, which may explain a difference.</p>}
                  </td>
                  <td className="py-2">{l.shifts}</td>
                  <td className="py-2">{l.hours}</td>
                  <td className="py-2">{l.weekendShifts}</td>
                  <td className="py-2">{l.nightShifts}</td>
                  <td className="py-2">{l.shortNoticeChanges}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
