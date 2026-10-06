import { SPONSOR_LEGAL_REF, SPONSOR_ROUTE_LABEL } from "@vicisrota/compliance";
import { withOrganisation } from "@vicisrota/db";
import Link from "next/link";
import { requireManager } from "@/lib/business";
import { db } from "@/lib/db";
import { todayInUk } from "@/lib/rota";
import { loadSponsorship } from "@/lib/sponsorship";
import { undoReported } from "./actions";
import { ReportedForm } from "./forms";

const ukDate = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-GB", { timeZone: "UTC", day: "numeric", month: "long", year: "numeric" });
const pounds = (pence: number) => `£${(pence / 100).toLocaleString("en-GB", { maximumFractionDigits: 2 })}`;

/** What a sponsor must report or check for each sponsored worker, with the deadline for each report. */
export default async function SponsorshipPage() {
  const { organisationId } = await requireManager();
  const today = todayInUk();
  const { workers, duties } = await withOrganisation(db, organisationId, (tx) => loadSponsorship(tx, organisationId, today));
  const toReport = duties.filter((d) => d.reportBy && !d.reported);
  const reported = duties.filter((d) => d.reported);
  const toCheck = duties.filter((d) => !d.reportBy);
  const name = new Map(workers.map((w) => [w.id, w.fullName]));

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 lg:px-8">
      <h1 className="text-2xl font-semibold">Sponsored workers</h1>
      <p className="mt-2 text-zinc-700 dark:text-zinc-300">
        If you sponsor anyone&apos;s visa, the Home Office expects you to keep track of their attendance and pay, and to report some changes on the
        Sponsor Management System within 10 working days. VicisRota checks the rota, clock-ins and timesheets for you and lists what is due.
      </p>
      <p className="mt-2 text-sm text-muted">Based on: {SPONSOR_LEGAL_REF}. Deadlines count Monday to Friday and do not skip bank holidays, so they are never late.</p>

      {workers.length === 0 ? (
        <p className="mt-6 rounded-lg border border-zinc-300 p-4 dark:border-zinc-700">
          Nobody is marked as sponsored. To add someone, open their record on the <Link href="/staff" className="underline">Staff page</Link> and fill in
          Visa sponsorship.
        </p>
      ) : (
        <>
          <section className="mt-8" aria-labelledby="report-heading">
            <h2 id="report-heading" className="text-lg font-semibold">To report</h2>
            {toReport.length === 0 ? (
              <p className="mt-2">Nothing to report right now.</p>
            ) : (
              <ul className="mt-3 flex flex-col gap-3">
                {toReport.map((d) => (
                  <li key={`${d.workerId}-${d.kind}-${d.eventDate}`} className={`rounded-lg border-2 p-3 ${d.reportBy! < today ? "border-red-600" : "border-amber-500"}`}>
                    <p className="font-semibold">
                      {d.reportBy! < today ? `Overdue: was due by ${ukDate(d.reportBy!)}` : `Report by ${ukDate(d.reportBy!)}`}
                    </p>
                    <p className="mt-1">{d.message}</p>
                    <ReportedForm workerId={d.workerId} kind={d.kind} eventDate={d.eventDate} today={today} />
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="mt-8" aria-labelledby="check-heading">
            <h2 id="check-heading" className="text-lg font-semibold">To look at</h2>
            {toCheck.length === 0 ? (
              <p className="mt-2">Nothing to look at. Pay and permission to work are in order.</p>
            ) : (
              <ul className="mt-3 flex flex-col gap-2">
                {toCheck.map((d) => (
                  <li key={`${d.workerId}-${d.kind}-${d.eventDate}`} className="rounded-lg border border-amber-500 p-3">
                    {d.message}{" "}
                    <Link href={`/staff/${d.workerId}${d.kind === "pay" ? "" : "#right-to-work"}`} className="underline">
                      Open {name.get(d.workerId)}&apos;s record
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="mt-8" aria-labelledby="people-heading">
            <h2 id="people-heading" className="text-lg font-semibold">Who you sponsor</h2>
            <ul className="mt-3 flex flex-col gap-2">
              {workers.map((w) => {
                const s = w.sponsorship!;
                return (
                  <li key={w.id} className="rounded-lg border border-zinc-300 p-3 dark:border-zinc-700">
                    <p className="font-medium">
                      <Link href={`/staff/${w.id}#sponsorship`} className="underline">{w.fullName}</Link>
                      {w.leftOn && ` · left ${ukDate(w.leftOn)}`}
                    </p>
                    <p className="text-sm text-muted">
                      {[
                        SPONSOR_ROUTE_LABEL[s.route],
                        s.cosNumber && `certificate ${s.cosNumber}`,
                        s.weeklyHours && `${s.weeklyHours} hours a week`,
                        s.annualSalaryPence && `${pounds(s.annualSalaryPence)} a year`,
                        s.startedOn && `since ${ukDate(s.startedOn)}`,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                    {!s.annualSalaryPence && <p className="mt-1 text-sm">Add their salary to have pay checked against it.</p>}
                  </li>
                );
              })}
            </ul>
          </section>

          {reported.length > 0 && (
            <section className="mt-8" aria-labelledby="done-heading">
              <h2 id="done-heading" className="text-lg font-semibold">Already reported</h2>
              <ul className="mt-3 flex flex-col gap-2 text-sm">
                {reported.map((d) => (
                  <li key={d.reported!.id} className="flex flex-wrap items-start justify-between gap-2 rounded-lg border border-zinc-300 p-3 dark:border-zinc-700">
                    <span>
                      {d.message} Reported {ukDate(d.reported!.reportedOn)}
                      {d.reported!.reference && `, reference ${d.reported!.reference}`}.
                    </span>
                    <form action={undoReported}>
                      <input type="hidden" name="id" value={d.reported!.id} />
                      <button type="submit" className="rounded-lg border border-zinc-500 px-3 py-1">Undo</button>
                    </form>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </main>
  );
}
