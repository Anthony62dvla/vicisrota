import { addDays, GUARANTEED_HOURS_LEGAL_REF, londonDateTime, londonParts, GUARANTEED_HOURS_WEEKS, reviewGuaranteedHours, weekStart, workedMillis } from "@vicisrota/compliance";
import { schema, withOrganisation } from "@vicisrota/db";
import { and, desc, eq, gte, inArray, isNotNull, isNull, lt, or } from "drizzle-orm";
import { requireManager } from "@/lib/business";
import { db } from "@/lib/db";
import { todayInUk } from "@/lib/rota";
import { answerOffer } from "./actions";
import { ContractedHoursForm, OfferForm } from "./forms";

const ukDate = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-GB", { timeZone: "UTC", day: "numeric", month: "long", year: "numeric" });
const hrs = (h: number) => `${+h.toFixed(2)} hour${h === 1 ? "" : "s"}`;

/** People on zero or low hours contracts, the hours they really work, and offers of guaranteed hours. */
export default async function GuaranteedHoursPage() {
  const { organisationId } = await requireManager();
  const today = todayInUk();
  const from = new Date(londonDateTime(addDays(weekStart(today), -7 * GUARANTEED_HOURS_WEEKS), "00:00"));
  const to = new Date(londonDateTime(weekStart(today), "00:00"));
  const { workers, shifts, breaks, offers } = await withOrganisation(db, organisationId, async (tx) => {
    const workers = await tx
      .select()
      .from(schema.worker)
      .where(and(isNull(schema.worker.leftOn), or(eq(schema.worker.irregularHours, true), isNotNull(schema.worker.contractedHours))))
      .orderBy(schema.worker.fullName);
    const ids = workers.map((w) => w.id);
    if (!ids.length) return { workers, shifts: [], breaks: [], offers: [] };
    const shifts = await tx
      .select()
      .from(schema.shift)
      .where(and(inArray(schema.shift.workerId, ids), eq(schema.shift.status, "published"), gte(schema.shift.startsAt, from), lt(schema.shift.startsAt, to)));
    return {
      workers,
      shifts,
      breaks: shifts.length ? await tx.select().from(schema.shiftBreak).where(inArray(schema.shiftBreak.shiftId, shifts.map((s) => s.id))) : [],
      offers: await tx.select().from(schema.guaranteedHoursOffer).where(inArray(schema.guaranteedHoursOffer.workerId, ids)).orderBy(desc(schema.guaranteedHoursOffer.offeredOn)),
    };
  });
  const rows = workers.map((w) => {
    const worked = shifts
      .filter((s) => s.workerId === w.id)
      .map((s) => ({
        date: londonParts(s.startsAt.getTime()).date,
        hours:
          workedMillis({
            id: s.id,
            workerId: w.id,
            start: s.startsAt.toISOString(),
            end: s.endsAt.toISOString(),
            breaks: breaks.filter((b) => b.shiftId === s.id).map((b) => ({ start: b.startsAt.toISOString(), end: b.endsAt.toISOString() })),
          }) / 3_600_000,
      }));
    return { worker: w, review: reviewGuaranteedHours(worked, w.contractedHours ?? 0, today), offers: offers.filter((o) => o.workerId === w.id) };
  });
  const period = rows[0]?.review;

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 lg:px-8">
      <h1 className="text-2xl font-semibold">Guaranteed hours</h1>
      <p className="mt-2 text-zinc-700 dark:text-zinc-300">
        A new law will give people on zero-hours and low-hours contracts the right to be offered a contract that matches the hours they regularly work. This
        page gets you ready: it compares each person&apos;s contract with the hours they worked in the last {GUARANTEED_HOURS_WEEKS} full weeks, so you can offer
        guaranteed hours and record their answer.
      </p>
      <p className="mt-2 text-sm text-muted">
        Based on: {GUARANTEED_HOURS_LEGAL_REF}. Hours come from published shifts after unpaid breaks. Shown are people with varying hours, or with contract hours
        recorded here.
      </p>
      {period && (
        <p className="mt-2 text-sm text-muted">
          Weeks looked at: {ukDate(period.from)} to {ukDate(period.to)}.
        </p>
      )}
      {rows.length === 0 ? (
        <p className="mt-6 rounded-lg border border-zinc-300 p-4 dark:border-zinc-700">
          Nobody is shown yet. Tick &quot;Irregular hours&quot; for people whose hours vary on their staff record, under Holiday.
        </p>
      ) : (
        <ul className="mt-6 flex flex-col gap-4">
          {rows.map(({ worker: w, review: r, offers: list }) => {
            const open = list.find((o) => o.status === "offered");
            return (
              <li key={w.id} className={`rounded-lg p-4 ${r.offerDue && !open ? "border-2 border-amber-500" : "border border-zinc-300 dark:border-zinc-700"}`}>
                <p className="font-semibold">{w.fullName}</p>
                <p className="mt-1">
                  Contract: {w.contractedHours == null ? "not recorded" : w.contractedHours === 0 ? "zero hours" : `${hrs(w.contractedHours)} a week`}. Worked on
                  average {hrs(r.averageHours)} a week, in {r.weeksWorked} of the last {GUARANTEED_HOURS_WEEKS} weeks.
                </p>
                {r.offerDue && !open && (
                  <p className="mt-1 font-medium">They regularly work more than their contract. Consider offering {hrs(r.suggestedHours)} a week.</p>
                )}
                {list.length > 0 && (
                  <ul className="mt-2 list-disc pl-6">
                    {list.map((o) => (
                      <li key={o.id}>
                        Offered {hrs(o.weeklyHours)} a week on {ukDate(o.offeredOn)}:{" "}
                        {o.status === "offered" ? "waiting for their answer" : o.status === "accepted" ? `accepted ${ukDate(o.answeredOn!)}` : `declined ${ukDate(o.answeredOn!)}`}
                        {o.status === "offered" && (
                          <span className="ml-2 inline-flex gap-2">
                            <form action={answerOffer}>
                              <input type="hidden" name="offerId" value={o.id} />
                              <button name="answer" value="accepted" className="underline">They accepted</button>
                            </form>
                            <form action={answerOffer}>
                              <input type="hidden" name="offerId" value={o.id} />
                              <button name="answer" value="declined" className="underline">They declined</button>
                            </form>
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
                <div className="mt-3 flex flex-wrap gap-6">
                  <ContractedHoursForm workerId={w.id} name={w.fullName} hours={w.contractedHours} />
                  {!open && <OfferForm workerId={w.id} suggested={Math.max(r.suggestedHours, 0.5)} />}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
