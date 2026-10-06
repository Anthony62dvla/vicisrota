import { AGENCY_LEGAL_REF, AGENCY_QUALIFYING_WEEKS, agencyProgress, londonParts } from "@vicisrota/compliance";
import { schema, withOrganisation } from "@vicisrota/db";
import { and, eq, inArray, isNotNull, isNull, ne } from "drizzle-orm";
import Link from "next/link";
import { requireManager } from "@/lib/business";
import { db } from "@/lib/db";
import { todayInUk } from "@/lib/rota";

const ukDate = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-GB", { timeZone: "UTC", day: "numeric", month: "long", year: "numeric" });

/** Agency workers and how far each is through the 12 weeks before equal treatment. */
export default async function AgencyPage() {
  const { organisationId } = await requireManager();
  const today = todayInUk();
  const people = await withOrganisation(db, organisationId, async (tx) => {
    const workers = await tx.select().from(schema.worker).where(and(isNotNull(schema.worker.agency), isNull(schema.worker.leftOn))).orderBy(schema.worker.fullName);
    if (!workers.length) return [];
    const ids = workers.map((w) => w.id);
    const [shifts, leave] = await Promise.all([
      tx.select({ workerId: schema.shift.workerId, startsAt: schema.shift.startsAt }).from(schema.shift).where(and(inArray(schema.shift.workerId, ids), ne(schema.shift.status, "cancelled"))),
      tx.select().from(schema.leaveRequest).where(and(inArray(schema.leaveRequest.workerId, ids), eq(schema.leaveRequest.status, "approved"))),
    ]);
    return workers.map((w) => ({
      worker: w,
      progress: agencyProgress({
        startedOn: w.agency!.startedOn,
        workedOn: shifts.filter((s) => s.workerId === w.id).map((s) => londonParts(s.startsAt.getTime()).date),
        leave: leave.filter((l) => l.workerId === w.id),
        asOf: today,
      }),
    }));
  });

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 lg:px-8">
      <h1 className="text-2xl font-semibold">Agency workers</h1>
      <p className="mt-2 text-zinc-700 dark:text-zinc-300">
        From their first day, agency workers can use your staff facilities (such as the canteen and parking) and must be told about your job vacancies.
        After {AGENCY_QUALIFYING_WEEKS} weeks in the same role, they have the right to the same basic pay, hours, breaks and holiday as if you had hired them
        directly. Tell the agency when someone is close, so their pay can change on time.
      </p>
      <p className="mt-2 text-sm text-muted">
        Based on: {AGENCY_LEGAL_REF}. A week is 7 days from the day the assignment started, and any work in it counts. Sickness and holiday pause the count;
        pregnancy and maternity leave count towards it; a break of more than 6 weeks for another reason starts it again. Shifts on the rota count from VicisRota.
      </p>
      {people.length === 0 ? (
        <p className="mt-6 rounded-lg border border-zinc-300 p-4 dark:border-zinc-700">
          Nobody is marked as an agency worker. To add someone, open their record on the <Link href="/staff" className="underline">Staff page</Link> and fill in
          Agency worker.
        </p>
      ) : (
        <ul className="mt-6 flex flex-col gap-3">
          {people.map(({ worker: w, progress: p }) => {
            const soon = !p.qualifiedOn && p.weeks >= AGENCY_QUALIFYING_WEEKS - 2;
            return (
              <li key={w.id} className={`rounded-lg p-4 ${p.qualifiedOn ? "border-2 border-brand" : soon ? "border-2 border-amber-500" : "border border-zinc-300 dark:border-zinc-700"}`}>
                <p className="font-semibold">
                  <Link href={`/staff/${w.id}#agency`} className="underline">{w.fullName}</Link>
                </p>
                <p className="text-sm text-muted">
                  {w.agency!.agencyName}
                  {w.agency!.role ? ` · ${w.agency!.role}` : ""} · assignment started {ukDate(w.agency!.startedOn)}
                </p>
                <p className="mt-2">
                  {p.qualifiedOn
                    ? `Has had equal treatment rights since ${ukDate(p.qualifiedOn)}. Check with the agency that their pay and conditions match your own staff.`
                    : `${p.weeks} of ${AGENCY_QUALIFYING_WEEKS} weeks done. If they work every week, equal treatment starts on ${ukDate(p.expectedOn!)}.`}
                </p>
                {p.restartedOn && <p className="mt-1 text-sm">The count started again on {ukDate(p.restartedOn)} after a break of more than 6 weeks.</p>}
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
