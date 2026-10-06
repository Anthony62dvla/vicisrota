import { addDays, FAMILY_LEAVE, familyLeaveNotes, isFamilyLeave } from "@vicisrota/compliance";
import { schema, withOrganisation } from "@vicisrota/db";
import { and, asc, eq, gte, inArray } from "drizzle-orm";
import Link from "next/link";
import { requireManager } from "@/lib/business";
import { db } from "@/lib/db";
import { formatAmount, LEAVE_LABEL, leaveChoices, loadBalances } from "@/lib/leave";
import { todayInUk } from "@/lib/rota";
import { removeKeepingInTouchDay } from "./actions";
import { BookLeaveForm, DecisionList, KeepingInTouchForm } from "./forms";

const ukDate = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-GB", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short", year: "numeric" });
const span = (a: string, b: string) => (a === b ? ukDate(a) : `${ukDate(a)} to ${ukDate(b)}`);

export default async function LeavePage() {
  const { organisationId } = await requireManager();
  const today = todayInUk();
  const { workers, leave, year, balances, carers, kit } = await withOrganisation(db, organisationId, async (tx) => ({
    // Carer's leave over the last two years, to add up a rolling 12 months.
    carers: await tx
      .select()
      .from(schema.leaveRequest)
      .where(and(eq(schema.leaveRequest.kind, "carers"), inArray(schema.leaveRequest.status, ["requested", "approved"]), gte(schema.leaveRequest.endsOn, addDays(today, -730)))),
    kit: await tx.select().from(schema.keepingInTouchDay).orderBy(asc(schema.keepingInTouchDay.workedOn)),
    workers: await tx.select().from(schema.worker).orderBy(asc(schema.worker.fullName)),
    leave: await tx
      .select()
      .from(schema.leaveRequest)
      .where(and(inArray(schema.leaveRequest.status, ["requested", "approved"]), gte(schema.leaveRequest.endsOn, addDays(today, -30))))
      .orderBy(asc(schema.leaveRequest.startsOn)),
    ...(await loadBalances(tx, organisationId, today)),
  }));
  const name = new Map(workers.map((w) => [w.id, w.fullName]));
  const pending = leave.filter((l) => l.status === "requested");
  const approved = leave.filter((l) => l.status === "approved");
  const amount = (l: (typeof leave)[number]) =>
    l.kind !== "annual" ? "" : l.hours != null ? ` · ${formatAmount(l.hours, "hours")}` : l.days != null ? ` · ${formatAmount(l.days, "days")}` : "";

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 lg:px-8">
      <h1 className="text-2xl font-semibold">Leave and holiday</h1>

      {workers.length === 0 ? (
        <p className="mt-4">Add your staff first on the <Link href="/staff" className="underline">Staff page</Link>.</p>
      ) : (
        <>
          <section className="mt-8" aria-labelledby="pending-heading">
            <h2 id="pending-heading" className="text-lg font-semibold">Waiting for a decision</h2>
            <DecisionList
              tone="pending"
              empty="Nothing waiting."
              items={pending.map((l) => ({
                id: l.id,
                title: `${name.get(l.workerId)}: ${LEAVE_LABEL[l.kind]}`,
                detail: `${span(l.startsOn, l.endsOn)}${amount(l)}`,
                notes: familyLeaveNotes(l, carers.filter((c) => c.workerId === l.workerId)),
                options: [
                  { decision: "approved", label: "Approve" },
                  { decision: "declined", label: "Decline" },
                ],
              }))}
            />
          </section>

          <section className="mt-8" aria-labelledby="booked-heading">
            <h2 id="booked-heading" className="text-lg font-semibold">Approved leave</h2>
            <DecisionList
              tone="booked"
              empty="No leave booked."
              items={approved.map((l) => ({
                id: l.id,
                title: `${name.get(l.workerId)}: ${LEAVE_LABEL[l.kind]}`,
                detail: `${span(l.startsOn, l.endsOn)}${amount(l)}`,
                options: l.endsOn >= today ? [{ decision: "cancelled", label: "Cancel leave" }] : [],
              }))}
            />
          </section>

          {approved.some((l) => isFamilyLeave(l.kind) && FAMILY_LEAVE[l.kind].keepingInTouchDays != null && l.endsOn >= today) && (
            <section className="mt-8" aria-labelledby="kit-heading">
              <h2 id="kit-heading" className="text-lg font-semibold">Keeping in touch days</h2>
              <p className="mt-1 text-sm text-muted">
                Days someone on maternity or adoption leave (up to 10) or shared parental leave (up to 20) works without ending their leave. They are
                optional for both of you, and agreed together. Once a day is added, you can put a shift on the rota that day.
              </p>
              <ul className="mt-3 flex flex-col gap-3">
                {approved
                  .filter((l) => isFamilyLeave(l.kind) && FAMILY_LEAVE[l.kind].keepingInTouchDays != null && l.endsOn >= today)
                  .map((l) => {
                    const days = kit.filter((k) => k.leaveRequestId === l.id);
                    const limit = isFamilyLeave(l.kind) ? FAMILY_LEAVE[l.kind].keepingInTouchDays! : 0;
                    return (
                      <li key={l.id} className="rounded-lg border border-zinc-300 p-3 dark:border-zinc-700">
                        <p className="font-medium">
                          {name.get(l.workerId)}: {LEAVE_LABEL[l.kind]}, {span(l.startsOn, l.endsOn)}
                        </p>
                        <p className="text-sm">
                          {days.length} of {limit} days used.
                        </p>
                        {days.length > 0 && (
                          <ul className="mt-1 text-sm">
                            {days.map((d) => (
                              <li key={d.id} className="flex flex-wrap items-center gap-2">
                                {ukDate(d.workedOn)}
                                {d.note ? ` · ${d.note}` : ""}
                                <form action={removeKeepingInTouchDay}>
                                  <input type="hidden" name="id" value={d.id} />
                                  <button type="submit" className="underline">Remove</button>
                                </form>
                              </li>
                            ))}
                          </ul>
                        )}
                        {days.length < limit && <KeepingInTouchForm leaveRequestId={l.id} startsOn={l.startsOn} endsOn={l.endsOn} />}
                      </li>
                    );
                  })}
              </ul>
            </section>
          )}

          <section className="mt-8" aria-labelledby="balance-heading">
            <h2 id="balance-heading" className="text-lg font-semibold">Holiday balances</h2>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Leave year {ukDate(year.start)} to {ukDate(year.end)}. The legal minimum is 5.6 weeks, up to 28 days. People who start part way through the year get a share of it.
              People on irregular hours build up 12.07% of the hours they work.
            </p>
            <table className="mt-3 w-full text-left">
              <thead>
                <tr className="border-b border-zinc-300 dark:border-zinc-700">
                  <th className="py-2">Name</th>
                  <th className="py-2">Holiday for the year</th>
                  <th className="py-2">Approved</th>
                  <th className="py-2">Requested</th>
                  <th className="py-2">Left</th>
                </tr>
              </thead>
              <tbody>
                {workers.map((w) => {
                  const b = balances.get(w.id)!;
                  return (
                    <tr key={w.id} className="border-b border-zinc-200 dark:border-zinc-800">
                      <td className="py-2"><Link href={`/staff/${w.id}`} className="underline">{w.fullName}</Link></td>
                      <td className="py-2">{formatAmount(b.entitlement, b.unit)}{b.unit === "hours" && " so far"}</td>
                      <td className="py-2">{formatAmount(b.taken, b.unit)}</td>
                      <td className="py-2">{formatAmount(b.requested, b.unit)}</td>
                      <td className="py-2">{b.remaining < 0 ? <strong>{formatAmount(b.remaining, b.unit)}</strong> : formatAmount(b.remaining, b.unit)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>

          <section className="mt-10" aria-labelledby="book-heading">
            <h2 id="book-heading" className="text-lg font-semibold">Book leave</h2>
            <BookLeaveForm
              workers={workers.map((w) => ({ id: w.id, name: w.fullName, unit: w.irregularHours ? "hours" : "days" }))}
              kinds={leaveChoices()}
            />
          </section>
        </>
      )}
    </main>
  );
}
