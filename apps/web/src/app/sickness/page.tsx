import { addDays, SSP_WEEKLY_RATES } from "@vicisrota/compliance";
import { schema, withOrganisation } from "@vicisrota/db";
import { and, asc, eq } from "drizzle-orm";
import Link from "next/link";
import { requireManager } from "@/lib/business";
import { db } from "@/lib/db";
import { todayInUk } from "@/lib/rota";
import { loadSickness, WEEKDAY_NAMES, type SicknessRecord } from "@/lib/sickness";
import { DecisionList } from "../leave/forms";
import { EarningsForm, FitNoteButton, LastDayForm, RecordSicknessForm } from "./forms";

const ukDate = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-GB", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short", year: "numeric" });
const span = (a: string, b: string) => (a === b ? ukDate(a) : `${ukDate(a)} to ${ukDate(b)}`);
const pounds = (p: number) => `£${(p / 100).toFixed(2)}`;
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

export default async function SicknessPage() {
  const { organisationId } = await requireManager();
  const today = todayInUk();
  const { workers, reported, sickness } = await withOrganisation(db, organisationId, async (tx) => ({
    workers: await tx.select({ id: schema.worker.id, name: schema.worker.fullName }).from(schema.worker).orderBy(asc(schema.worker.fullName)),
    reported: await tx
      .select()
      .from(schema.leaveRequest)
      .where(and(eq(schema.leaveRequest.kind, "sick"), eq(schema.leaveRequest.status, "requested")))
      .orderBy(asc(schema.leaveRequest.startsOn)),
    // Future-dated sickness is unusual but allowed (for example an operation), so look a year ahead.
    sickness: await loadSickness(tx, addDays(today, 366)),
  }));
  const name = new Map(workers.map((w) => [w.id, w.name]));
  const yearAgo = addDays(today, -365);
  const all = [...sickness.values()].flatMap((s) => s.records.map((r) => ({ ...r, weekdays: s.qualifyingWeekdays })));
  const offNow = all.filter((r) => r.startsOn <= today && r.endsOn >= today);
  const recent = all.filter((r) => r.endsOn >= yearAgo).sort((a, b) => (a.startsOn < b.startsOn ? 1 : -1));
  const rate = SSP_WEEKLY_RATES.findLast((r) => r.from <= today) ?? SSP_WEEKLY_RATES[0]!;

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 lg:px-8">
      <h1 className="text-2xl font-semibold">Sickness</h1>
      <p className="mt-2 text-zinc-700 dark:text-zinc-300">
        Record time off sick and see the Statutory Sick Pay each person is due. Sick pay goes into the payroll export.
      </p>

      {reported.length > 0 && (
        <section className="mt-8" aria-labelledby="reported-heading">
          <h2 id="reported-heading" className="text-lg font-semibold">Reported by staff</h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">Confirm these so they count for sick pay.</p>
          <DecisionList
            tone="pending"
            empty=""
            items={reported.map((l) => ({
              id: l.id,
              title: `${name.get(l.workerId)} is off sick`,
              detail: span(l.startsOn, l.endsOn),
              options: [
                { decision: "approved", label: "Confirm" },
                { decision: "declined", label: "Not sickness" },
              ],
            }))}
          />
        </section>
      )}

      <section className="mt-8" aria-labelledby="now-heading">
        <h2 id="now-heading" className="text-lg font-semibold">Off sick today</h2>
        {offNow.length === 0 ? (
          <p className="mt-2">Nobody.</p>
        ) : (
          <ul className="mt-2 list-disc pl-6">
            {offNow.map((r) => (
              <li key={r.id}>
                {name.get(r.workerId)}, expected back after {ukDate(r.endsOn)}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-8" aria-labelledby="recent-heading">
        <h2 id="recent-heading" className="text-lg font-semibold">The last 12 months</h2>
        {recent.length === 0 ? (
          <p className="mt-2">No sickness recorded.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-3">
            {recent.map((r) => (
              <SicknessItem key={r.id} record={r} name={name.get(r.workerId) ?? "Someone"} qualifyingDays={r.weekdays} />
            ))}
          </ul>
        )}
      </section>

      <section className="mt-8" aria-labelledby="record-heading">
        <h2 id="record-heading" className="text-lg font-semibold">Record sickness</h2>
        {workers.length === 0 ? (
          <p className="mt-2">Add your staff first on the <Link href="/staff" className="underline">Staff page</Link>.</p>
        ) : (
          <RecordSicknessForm workers={workers} today={today} />
        )}
      </section>

      <section className="mt-10 rounded-lg border border-zinc-300 p-4 text-sm dark:border-zinc-700" aria-labelledby="rules-heading">
        <h2 id="rules-heading" className="font-semibold">How sick pay is worked out</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Since 6 April 2026 Statutory Sick Pay is paid from the first day off sick, including single days.</li>
          <li>
            It is the lower of {pounds(rate.pence)} a week and 80% of the person&apos;s average weekly earnings, split across the days they
            normally work. Days they would not have worked are not paid.
          </li>
          <li>Time off sick 56 days or less apart counts as one period, using the earnings from its start. SSP stops after 28 weeks in a period.</li>
          <li>People can self-certify for the first 7 days. After that you can ask for a fit note.</li>
          <li>Sickness that began before 6 April 2026 follows the old rules, which VicisRota does not work out. Your payroll will need to.</li>
          <li>Your own sick pay scheme can pay more than this. SSP is the legal minimum.</li>
        </ul>
      </section>
    </main>
  );
}

function SicknessItem({ record: r, name, qualifyingDays }: { record: SicknessRecord; name: string; qualifyingDays: number[] }) {
  const { ssp } = r;
  const isStart = ssp.periodStartId === r.id;
  const notes = [
    ssp.oldRules && "Began before 6 April 2026: work out SSP under the old rules.",
    ssp.linked && "Linked to earlier sickness, so it shares that period's earnings and 28 weeks.",
    ssp.exhaustedOn && `SSP ran out on ${ukDate(ssp.exhaustedOn)}. Give them form SSP1 so they can claim other benefits.`,
    ssp.fitNoteNeeded && (r.fitNoteOn ? `Fit note received ${ukDate(r.fitNoteOn)}.` : "Over 7 days: ask for a fit note."),
    !ssp.oldRules &&
      r.earningsPence === 0 &&
      (isStart
        ? "No earnings found in the 8 weeks before, so no SSP. Enter their average weekly earnings if that is wrong."
        : `No earnings found before this period of sickness began on ${ukDate(r.periodStartsOn)}, so no SSP. Enter their earnings on that sickness if that is wrong.`),
  ].filter(Boolean);
  return (
    <li className="rounded-lg border border-zinc-300 p-3 dark:border-zinc-700">
      <p className="font-medium">
        {name}: {span(r.startsOn, r.endsOn)}
      </p>
      <p>
        {ssp.oldRules
          ? `${plural(ssp.qualifyingDays, "working day")} off`
          : `${plural(ssp.qualifyingDays, "working day")} off · SSP ${pounds(ssp.pence)} for ${plural(ssp.paidDays, "day")} (${pounds(ssp.weeklyPence)} a week)`}
      </p>
      {notes.length > 0 && (
        <ul className="mt-1 list-disc pl-5 text-sm">
          {notes.map((n) => (
            <li key={String(n)}>{n}</li>
          ))}
        </ul>
      )}
      <details className="mt-2">
        <summary className="cursor-pointer underline">Change or check</summary>
        <div className="mt-2 flex flex-col gap-4">
          <p className="text-sm">
            Working days used: {qualifyingDays.map((d) => WEEKDAY_NAMES[d]).join(", ")}. These come from the days they worked in the 8 weeks
            before.
            {!ssp.oldRules &&
              ` Average weekly earnings: ${pounds(r.earningsPence)}${r.earningsEstimated ? ", estimated from confirmed hours" : ", entered by a manager"}.`}
          </p>
          <LastDayForm id={r.id} endsOn={r.endsOn} name={name} />
          {ssp.fitNoteNeeded && !r.fitNoteOn && <FitNoteButton id={r.id} />}
          {isStart && !ssp.oldRules && (
            <EarningsForm
              id={r.id}
              pounds={r.sspWeeklyEarningsPence == null ? "" : (r.sspWeeklyEarningsPence / 100).toFixed(2)}
              estimate={r.earningsEstimated ? pounds(r.earningsPence) : "not shown while a figure is entered"}
            />
          )}
        </div>
      </details>
    </li>
  );
}
