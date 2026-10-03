import { addDays, londonDateTime, londonParts } from "@vicisrota/compliance";
import { schema, withOrganisation } from "@vicisrota/db";
import { and, asc, desc, eq, gte, inArray, lt } from "drizzle-orm";
import { requireStaff } from "@/lib/business";
import { db } from "@/lib/db";
import { formatAmount, LEAVE_KINDS, LEAVE_LABEL, loadBalances } from "@/lib/leave";
import { todayInUk } from "@/lib/rota";
import { SignOutButton } from "../dashboard/sign-out";
import { withdrawRequest } from "./actions";
import { TimeOffForm } from "./forms";

const MINUTE = 60_000;
/** How far ahead staff can see published shifts. */
const WEEKS_AHEAD = 4;
const timeFmt = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const longDate = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-GB", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" });
const STATUS = { requested: "Waiting for your manager", approved: "Approved", declined: "Not approved", cancelled: "Withdrawn" } as const;

export default async function MyPage() {
  const { user, organisationId, businessName, worker } = await requireStaff();
  const today = todayInUk();
  const from = new Date(londonDateTime(today, "00:00"));
  const to = new Date(londonDateTime(addDays(today, WEEKS_AHEAD * 7), "00:00"));

  const data = await withOrganisation(db, organisationId, async (tx) => {
    // Every query below is limited to this person's own records.
    const shifts = await tx
      .select()
      .from(schema.shift)
      .where(and(eq(schema.shift.workerId, worker.id), eq(schema.shift.status, "published"), gte(schema.shift.endsAt, from), lt(schema.shift.startsAt, to)))
      .orderBy(asc(schema.shift.startsAt));
    const breaks = shifts.length
      ? await tx.select().from(schema.shiftBreak).where(inArray(schema.shiftBreak.shiftId, shifts.map((s) => s.id)))
      : [];
    // Only the clients this person is visiting, and only what a visiting carer needs.
    const clientIds = [...new Set(shifts.map((s) => s.clientId).filter((id): id is string => Boolean(id)))];
    const clients = clientIds.length
      ? await tx
          .select({ id: schema.client.id, name: schema.client.name, postcode: schema.client.postcode, visitNotes: schema.client.visitNotes })
          .from(schema.client)
          .where(inArray(schema.client.id, clientIds))
      : [];
    const leave = await tx
      .select()
      .from(schema.leaveRequest)
      .where(and(eq(schema.leaveRequest.workerId, worker.id), gte(schema.leaveRequest.endsOn, addDays(today, -60))))
      .orderBy(desc(schema.leaveRequest.startsOn));
    const { balances, year } = await loadBalances(tx, organisationId, today);
    return { shifts, breaks, clients, leave, balance: balances.get(worker.id)!, year };
  });

  const days = new Map<string, typeof data.shifts>();
  for (const s of data.shifts) {
    const d = londonParts(s.startsAt.getTime()).date;
    days.set(d, [...(days.get(d) ?? []), s]);
  }
  const { balance } = data;
  const unit = worker.irregularHours ? "hours" : "days";

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-12">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Hello, {user.name}</h1>
          <p className="text-zinc-600 dark:text-zinc-400">{businessName}</p>
        </div>
        <SignOutButton />
      </div>

      <section className="mt-8" aria-labelledby="shifts-heading">
        <h2 id="shifts-heading" className="text-lg font-semibold">Your shifts</h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Published shifts for the next {WEEKS_AHEAD} weeks. Times are UK time.</p>
        {days.size === 0 ? (
          <p className="mt-3">You have no published shifts coming up. Your manager publishes the rota each week.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-3">
            {[...days].map(([d, shifts]) => (
              <li key={d} className={`rounded-lg border p-3 ${d === today ? "border-zinc-900 dark:border-zinc-100" : "border-zinc-300 dark:border-zinc-700"}`}>
                <h3 className="font-semibold">{d === today ? `Today, ${longDate(d)}` : longDate(d)}</h3>
                {shifts.map((s) => {
                  const unpaid = data.breaks.filter((b) => b.shiftId === s.id).reduce((sum, b) => sum + (b.endsAt.getTime() - b.startsAt.getTime()), 0);
                  const paidHours = (s.endsAt.getTime() - s.startsAt.getTime() - unpaid) / 3_600_000;
                  const client = data.clients.find((c) => c.id === s.clientId);
                  return (
                    <div key={s.id} className="mt-1">
                      <p>
                        {timeFmt.format(s.startsAt)} to {timeFmt.format(s.endsAt)}
                        {client && <strong>{` · Visit to ${client.name}`}</strong>}
                        <span className="text-zinc-600 dark:text-zinc-400">
                          {" "}· {Number.isInteger(paidHours) ? paidHours : paidHours.toFixed(2).replace(/0$/, "")} {paidHours === 1 ? "hour" : "hours"}
                          {unpaid > 0 && `, ${Math.round(unpaid / MINUTE)} minute break`}
                        </span>
                      </p>
                      {client?.postcode && <p className="text-sm">{client.postcode}</p>}
                      {s.travelMinutes > 0 && <p className="text-sm">Allow {s.travelMinutes} minutes to travel from your previous visit.</p>}
                      {client?.visitNotes && <p className="mt-1 rounded-md bg-zinc-100 p-2 text-sm dark:bg-zinc-900">{client.visitNotes}</p>}
                    </div>
                  );
                })}
              </li>
            ))}
          </ul>
        )}
        <a href="/me/calendar.ics" className="mt-3 inline-block underline">Add your shifts to your phone or computer calendar</a>
      </section>

      <section className="mt-10" aria-labelledby="holiday-heading">
        <h2 id="holiday-heading" className="text-lg font-semibold">Your holiday</h2>
        <p className="mt-2">
          You have <strong>{formatAmount(balance.remaining, balance.unit)}</strong> left
          {balance.unit === "hours" ? ", built up from the hours you have worked" : ` of ${formatAmount(balance.entitlement, balance.unit)}`} this
          holiday year.
          {balance.requested > 0 && ` Waiting for your manager: ${formatAmount(balance.requested, balance.unit)}.`}
        </p>
      </section>

      <section className="mt-10" aria-labelledby="requests-heading">
        <h2 id="requests-heading" className="text-lg font-semibold">Your time off</h2>
        {data.leave.length === 0 ? (
          <p className="mt-2">No time off booked or requested.</p>
        ) : (
          <ul className="mt-2 flex flex-col gap-2">
            {data.leave.map((l) => (
              <li key={l.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-zinc-300 p-3 dark:border-zinc-700">
                <div>
                  <p className="font-medium">
                    {LEAVE_LABEL[l.kind]}: {l.startsOn === l.endsOn ? longDate(l.startsOn) : `${longDate(l.startsOn)} to ${longDate(l.endsOn)}`}
                  </p>
                  <p className="text-sm">{STATUS[l.status]}</p>
                </div>
                {l.status === "requested" && (
                  <form action={withdrawRequest}>
                    <input type="hidden" name="id" value={l.id} />
                    <button type="submit" className="rounded-lg border border-zinc-400 px-3 py-1 text-sm">Withdraw request</button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-10" aria-labelledby="ask-heading">
        <h2 id="ask-heading" className="text-lg font-semibold">Ask for time off</h2>
        <TimeOffForm unit={unit} kinds={LEAVE_KINDS.map((k) => ({ value: k, label: LEAVE_LABEL[k] }))} />
      </section>
    </main>
  );
}
