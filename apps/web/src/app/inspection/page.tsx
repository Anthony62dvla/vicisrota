import { addDays, londonParts } from "@vicisrota/compliance";
import { schema, withOrganisation } from "@vicisrota/db";
import { and, asc, gte, inArray, lt, ne } from "drizzle-orm";
import { requireManager } from "@/lib/business";
import { db } from "@/lib/db";
import { periodBounds } from "@/lib/payroll";
import { todayInUk } from "@/lib/rota";
import { PrintButton } from "../workplaces/poster/print-button";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
/** Longest period the pack covers, so it stays quick to load and to read. */
const MAX_DAYS = 92;
const ukDate = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-GB", { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" });
const dayLabel = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-GB", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" });
const DBS_LABEL = { basic: "Basic", standard: "Standard", enhanced: "Enhanced", enhanced_barred: "Enhanced with barred list" } as const;
const CATEGORY = {
  abuse_or_neglect: "Abuse or neglect",
  self_harm: "Self-harm",
  colleague_conduct: "A colleague's conduct",
  health_and_safety: "Health and safety",
  other: "Other",
} as const;

type Status = "ok" | "due" | "missing";
const STATUS_TEXT: Record<Status, string> = { ok: "In date", due: "Due or expired", missing: "Not recorded" };
const StatusCell = ({ status, children }: { status: Status; children?: React.ReactNode }) => (
  <td className={`py-2 pr-3 ${status === "ok" ? "" : "font-semibold text-red-700 dark:text-red-400"}`}>
    {children ?? STATUS_TEXT[status]}
    {status !== "ok" && children ? <span className="block text-xs font-normal">{STATUS_TEXT[status]}</span> : null}
  </td>
);

export default async function InspectionPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { organisationId, businessName } = await requireManager();
  const query = await searchParams;
  const today = todayInUk();
  let to = typeof query.to === "string" && DATE.test(query.to) ? query.to : today;
  let from = typeof query.from === "string" && DATE.test(query.from) ? query.from : addDays(to, -27);
  if (from > to || addDays(from, MAX_DAYS) < to) {
    to = today;
    from = addDays(today, -27);
  }
  const { start, end } = periodBounds(from, to);

  const data = await withOrganisation(db, organisationId, async (tx) => {
    const shifts = await tx
      .select({ id: schema.shift.id, workerId: schema.shift.workerId, startsAt: schema.shift.startsAt, endsAt: schema.shift.endsAt, loneWorking: schema.shift.loneWorking })
      .from(schema.shift)
      .where(and(ne(schema.shift.status, "cancelled"), ne(schema.shift.status, "draft"), gte(schema.shift.startsAt, start), lt(schema.shift.startsAt, end)));
    const lone = shifts.filter((s) => s.loneWorking).map((s) => s.id);
    const [organisation] = await tx.select({ sector: schema.organisation.sector, requiresEnhancedDbs: schema.organisation.requiresEnhancedDbs }).from(schema.organisation);
    return {
      organisation,
      shifts,
      workers: await tx.select({ id: schema.worker.id, name: schema.worker.fullName }).from(schema.worker).orderBy(asc(schema.worker.fullName)),
      checks: await tx.select().from(schema.workerCheck),
      qualifications: await tx.select().from(schema.qualification).orderBy(asc(schema.qualification.name)),
      held: await tx.select().from(schema.workerQualification),
      supervisions: await tx.select().from(schema.supervision),
      loneChecks: lone.length ? await tx.select({ kind: schema.loneWorkCheck.kind }).from(schema.loneWorkCheck).where(inArray(schema.loneWorkCheck.shiftId, lone)) : [],
      loneShifts: lone.length,
      // Counts only: the details of a concern never leave the safeguarding page.
      concerns: await tx
        .select({ category: schema.safeguardingConcern.category, status: schema.safeguardingConcern.status })
        .from(schema.safeguardingConcern)
        .where(and(gte(schema.safeguardingConcern.createdAt, start), lt(schema.safeguardingConcern.createdAt, end))),
      referrals: (
        await tx
          .select({ kind: schema.safeguardingAction.kind })
          .from(schema.safeguardingAction)
          .where(and(gte(schema.safeguardingAction.createdAt, start), lt(schema.safeguardingAction.createdAt, end)))
      ).filter((a) => a.kind === "referral").length,
      decisions: await tx
        .select({ publishable: schema.complianceDecision.publishable })
        .from(schema.complianceDecision)
        .where(and(gte(schema.complianceDecision.checkedAt, start), lt(schema.complianceDecision.checkedAt, end))),
      overrides: (
        await tx
          .select({ id: schema.complianceOverride.id })
          .from(schema.complianceOverride)
          .where(and(gte(schema.complianceOverride.createdAt, start), lt(schema.complianceOverride.createdAt, end)))
      ).length,
    };
  });

  // Staffing by day.
  const days: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) days.push(d);
  const byDay = days.map((d) => {
    const on = data.shifts.filter((s) => londonParts(s.startsAt.getTime()).date === d);
    const filled = on.filter((s) => s.workerId);
    return {
      date: d,
      shifts: on.length,
      people: new Set(filled.map((s) => s.workerId)).size,
      hours: Math.round(filled.reduce((h, s) => h + (s.endsAt.getTime() - s.startsAt.getTime()) / 3_600_000, 0) * 10) / 10,
      unfilled: on.length - filled.length,
    };
  });
  const unfilledTotal = byDay.reduce((n, d) => n + d.unfilled, 0);

  // Checks, training and supervision for each person, as of today.
  const people = data.workers.map((w) => {
    const rtw = data.checks.filter((c) => c.workerId === w.id && c.kind === "right_to_work").sort((a, b) => b.checkedOn.localeCompare(a.checkedOn))[0];
    const dbs = data.checks.filter((c) => c.workerId === w.id && c.kind === "dbs").sort((a, b) => b.checkedOn.localeCompare(a.checkedOn))[0];
    const rtwStatus: Status = !rtw ? "missing" : rtw.expiresOn && rtw.expiresOn < today ? "due" : "ok";
    const dbsStatus: Status = !dbs ? "missing" : data.organisation?.requiresEnhancedDbs && dbs.dbsLevel !== "enhanced_barred" ? "due" : "ok";
    const last = (kind: "supervision" | "appraisal") =>
      data.supervisions.filter((s) => s.workerId === w.id && s.kind === kind).sort((a, b) => b.heldOn.localeCompare(a.heldOn))[0];
    const sup = last("supervision");
    const app = last("appraisal");
    const supStatus = (s: typeof sup): Status => (!s ? "missing" : s.nextDueOn && s.nextDueOn < today ? "due" : "ok");
    return {
      ...w,
      rtw,
      rtwStatus,
      dbs,
      dbsStatus,
      training: data.qualifications.map((q) => {
        const h = data.held.filter((x) => x.workerId === w.id && x.qualificationId === q.id).sort((a, b) => (b.expiresOn ?? "9999").localeCompare(a.expiresOn ?? "9999"))[0];
        return { id: q.id, status: (!h ? "missing" : h.expiresOn && h.expiresOn < today ? "due" : "ok") as Status, expiresOn: h?.expiresOn ?? null };
      }),
      sup,
      supStatus: supStatus(sup),
      app,
      appStatus: supStatus(app),
    };
  });
  const gaps = {
    checks: people.filter((p) => p.rtwStatus !== "ok" || p.dbsStatus !== "ok").length,
    training: people.reduce((n, p) => n + p.training.filter((t) => t.status !== "ok").length, 0),
    supervision: people.filter((p) => p.supStatus !== "ok").length,
  };
  const help = data.loneChecks.filter((c) => c.kind === "help").length;
  const resolved = data.loneChecks.filter((c) => c.kind === "resolved").length;

  const th = "py-2 pr-3 font-semibold";
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 lg:px-8 print:max-w-none print:p-0">
      <h1 className="text-2xl font-semibold">Inspection pack</h1>
      <p className="mt-1">
        {businessName}, {ukDate(from)} to {ukDate(to)}. Staffing, checks, training, supervision, lone working and safeguarding in one place, for a CQC
        inspection or your own audits. Printed {ukDate(today)} from VicisRota.
      </p>
      <form className="mt-4 flex flex-wrap items-end gap-3 print:hidden" aria-label="Period">
        <label className="flex flex-col gap-1">
          <span className="font-medium">From</span>
          <input name="from" type="date" defaultValue={from} className="rounded-lg border border-zinc-400 px-3 py-2" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-medium">To</span>
          <input name="to" type="date" defaultValue={to} className="rounded-lg border border-zinc-400 px-3 py-2" />
        </label>
        <button type="submit" className="rounded-lg border border-zinc-400 px-4 py-2">Show period</button>
        <PrintButton label="Print or save as PDF" />
      </form>

      <section className="mt-8" aria-labelledby="summary-heading">
        <h2 id="summary-heading" className="text-lg font-semibold">Summary</h2>
        <ul className="mt-2 list-disc pl-6">
          <li>{data.shifts.length === 1 ? "1 published shift" : `${data.shifts.length} published shifts`}{data.shifts.length > 0 && (unfilledTotal === 0 ? ", all filled" : `, ${unfilledTotal} not filled`)}.</li>
          <li>{gaps.checks === 0 ? "Right to work and DBS checks recorded for everyone." : `${gaps.checks} ${gaps.checks === 1 ? "person needs" : "people need"} a right to work or DBS check updating.`}</li>
          <li>{gaps.training === 0 ? "All tracked training is in date." : `${gaps.training} training ${gaps.training === 1 ? "record is" : "records are"} missing or expired.`}</li>
          <li>{gaps.supervision === 0 ? "Supervisions are up to date." : `${gaps.supervision} ${gaps.supervision === 1 ? "person has" : "people have"} no supervision recorded, or one overdue.`}</li>
          <li>
            {data.decisions.length} rota checks against UK employment law, {data.decisions.filter((d) => d.publishable).length} passed; {data.overrides} warnings
            gone ahead with a recorded reason.
          </li>
        </ul>
      </section>

      <section className="mt-8 break-inside-avoid" aria-labelledby="staffing-heading">
        <h2 id="staffing-heading" className="text-lg font-semibold">Staffing by day</h2>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-300"><th className={th}>Day</th><th className={th}>Shifts</th><th className={th}>People</th><th className={th}>Hours</th><th className={th}>Not filled</th></tr>
            </thead>
            <tbody>
              {byDay.map((d) => (
                <tr key={d.date} className="border-b border-zinc-200">
                  <td className="py-1.5 pr-3">{dayLabel(d.date)}</td>
                  <td className="py-1.5 pr-3">{d.shifts}</td>
                  <td className="py-1.5 pr-3">{d.people}</td>
                  <td className="py-1.5 pr-3">{d.hours}</td>
                  <td className={`py-1.5 pr-3 ${d.unfilled ? "font-semibold text-red-700 dark:text-red-400" : ""}`}>{d.unfilled}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-8" aria-labelledby="checks-heading">
        <h2 id="checks-heading" className="text-lg font-semibold">Safer recruitment checks</h2>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-300"><th className={th}>Name</th><th className={th}>Right to work</th><th className={th}>DBS</th></tr>
            </thead>
            <tbody>
              {people.map((p) => (
                <tr key={p.id} className="border-b border-zinc-200 align-top">
                  <td className="py-2 pr-3">{p.name}</td>
                  <StatusCell status={p.rtwStatus}>{p.rtw && `Checked ${ukDate(p.rtw.checkedOn)}${p.rtw.expiresOn ? `, follow-up ${ukDate(p.rtw.expiresOn)}` : ""}`}</StatusCell>
                  <StatusCell status={p.dbsStatus}>{p.dbs && `${p.dbs.dbsLevel ? DBS_LABEL[p.dbs.dbsLevel] : "DBS"}, ${ukDate(p.dbs.checkedOn)}`}</StatusCell>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {data.qualifications.length > 0 && (
        <section className="mt-8" aria-labelledby="training-heading">
          <h2 id="training-heading" className="text-lg font-semibold">Training</h2>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-300">
                  <th className={th}>Name</th>
                  {data.qualifications.map((q) => <th key={q.id} className={th}>{q.name}</th>)}
                </tr>
              </thead>
              <tbody>
                {people.map((p) => (
                  <tr key={p.id} className="border-b border-zinc-200 align-top">
                    <td className="py-2 pr-3">{p.name}</td>
                    {p.training.map((t) => (
                      <StatusCell key={t.id} status={t.status}>{t.status !== "missing" ? (t.expiresOn ? `Until ${ukDate(t.expiresOn)}` : "Held") : undefined}</StatusCell>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="mt-8" aria-labelledby="supervision-heading">
        <h2 id="supervision-heading" className="text-lg font-semibold">Supervision and appraisal</h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Recorded on each person&apos;s staff page. Only dates are kept here.</p>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-300"><th className={th}>Name</th><th className={th}>Last supervision</th><th className={th}>Last appraisal</th></tr>
            </thead>
            <tbody>
              {people.map((p) => (
                <tr key={p.id} className="border-b border-zinc-200 align-top">
                  <td className="py-2 pr-3">{p.name}</td>
                  <StatusCell status={p.supStatus}>{p.sup && `${ukDate(p.sup.heldOn)}${p.sup.nextDueOn ? `, next due ${ukDate(p.sup.nextDueOn)}` : ""}`}</StatusCell>
                  <StatusCell status={p.appStatus}>{p.app && `${ukDate(p.app.heldOn)}${p.app.nextDueOn ? `, next due ${ukDate(p.app.nextDueOn)}` : ""}`}</StatusCell>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-8" aria-labelledby="lone-heading">
        <h2 id="lone-heading" className="text-lg font-semibold">Lone working</h2>
        <p className="mt-2">
          {data.loneShifts === 0
            ? "No lone working shifts in this period."
            : `${data.loneShifts} lone working shifts, with ${data.loneChecks.filter((c) => c.kind === "ok" || c.kind === "start" || c.kind === "finished").length} check-ins. ${help === 0 ? "No calls for help." : `${help} ${help === 1 ? "call" : "calls"} for help, ${resolved} marked as dealt with.`}`}
        </p>
      </section>

      <section className="mt-8" aria-labelledby="safeguarding-heading">
        <h2 id="safeguarding-heading" className="text-lg font-semibold">Safeguarding</h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Numbers only. The details of each concern stay on the Safeguarding page, for the people who handle them.</p>
        {data.concerns.length === 0 ? (
          <p className="mt-2">No concerns raised in this period.</p>
        ) : (
          <ul className="mt-2 list-disc pl-6">
            {(Object.keys(CATEGORY) as (keyof typeof CATEGORY)[])
              .filter((c) => data.concerns.some((x) => x.category === c))
              .map((c) => (
                <li key={c}>{CATEGORY[c]}: {data.concerns.filter((x) => x.category === c).length}</li>
              ))}
            <li>Still open: {data.concerns.filter((c) => c.status === "open" || c.status === "in_progress").length}. Referrals made: {data.referrals}.</li>
          </ul>
        )}
      </section>
    </main>
  );
}
