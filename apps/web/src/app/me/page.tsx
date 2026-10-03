import { addDays, londonDateTime, londonParts } from "@vicisrota/compliance";
import { schema, withOrganisation } from "@vicisrota/db";
import { and, asc, desc, eq, gt, gte, inArray, isNotNull, isNull, lt, ne, or } from "drizzle-orm";
import Link from "next/link";
import type { ReactNode } from "react";
import { requireStaff } from "@/lib/business";
import { db } from "@/lib/db";
import { formatAmount, LEAVE_KINDS, LEAVE_LABEL, loadBalances } from "@/lib/leave";
import { loadLoneShifts } from "@/lib/lone-working";
import { SHORT_NOTICE_HOURS } from "@/lib/notices";
import { todayInUk } from "@/lib/rota";
import { SignOutButton } from "../dashboard/sign-out";
import { markNoticesSeen, savePreferences, setCoverRequest, withdrawClaim, withdrawRequest } from "./actions";
import { LoneCheckIn, PickUpList, TimeOffForm } from "./forms";

const MINUTE = 60_000;
/** How far ahead staff can see published shifts. */
const WEEKS_AHEAD = 4;
const timeFmt = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const longDate = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-GB", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" });
const shortDate = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-GB", { timeZone: "UTC", day: "numeric", month: "long" });
const STATUS = { requested: "Waiting for your manager", approved: "Approved", declined: "Not approved", cancelled: "Withdrawn" } as const;

/** Calm mode keeps the essentials on screen and tucks everything else away until asked for. */
function More({ calm, children }: { calm: boolean; children: ReactNode }) {
  if (!calm) return <>{children}</>;
  return (
    <details className="mt-10 rounded-lg border border-zinc-300 p-4 dark:border-zinc-700">
      <summary className="cursor-pointer font-medium">More: holiday, time off, tips and picking up shifts</summary>
      {children}
    </details>
  );
}

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
    const available = await tx
      .select()
      .from(schema.shift)
      .where(
        and(
          eq(schema.shift.status, "published"),
          gt(schema.shift.startsAt, new Date()),
          lt(schema.shift.startsAt, to),
          or(isNull(schema.shift.workerId), and(isNotNull(schema.shift.coverRequestedAt), ne(schema.shift.workerId, worker.id))),
        ),
      )
      .orderBy(asc(schema.shift.startsAt));
    const myClaims = await tx
      .select({ claim: schema.shiftClaim, shift: schema.shift })
      .from(schema.shiftClaim)
      .innerJoin(schema.shift, eq(schema.shiftClaim.shiftId, schema.shift.id))
      .where(and(eq(schema.shiftClaim.workerId, worker.id), eq(schema.shiftClaim.status, "requested")));
    const leave = await tx
      .select()
      .from(schema.leaveRequest)
      .where(and(eq(schema.leaveRequest.workerId, worker.id), gte(schema.leaveRequest.endsOn, addDays(today, -60))))
      .orderBy(desc(schema.leaveRequest.startsOn));
    const { balances, year } = await loadBalances(tx, organisationId, today);
    // Staff have a right to see their own tip records.
    const tips = await tx
      .select({ id: schema.tipShare.id, pence: schema.tipShare.pence, hours: schema.tipShare.hours, allocation: schema.tipAllocation })
      .from(schema.tipShare)
      .innerJoin(schema.tipAllocation, eq(schema.tipShare.allocationId, schema.tipAllocation.id))
      .where(eq(schema.tipShare.workerId, worker.id))
      .orderBy(desc(schema.tipAllocation.periodTo))
      .limit(12);
    const [org] = await tx
      .select({ policy: schema.organisation.tippingPolicy })
      .from(schema.organisation)
      .where(eq(schema.organisation.id, organisationId));
    const now = new Date().getTime();
    // Lone working shifts starting within 30 minutes, under way, or ended in the last 2 hours without a check-out.
    // Finished ones stay until the shift ends, as confirmation the check-out went through.
    const lone = (await loadLoneShifts(tx, { from: new Date(now - 2 * 3_600_000), to: new Date(now + 30 * 60_000), now, workerId: worker.id })).filter(
      (l) => l.status.state !== "finished" || l.shift.endsAt.getTime() > now,
    );
    const notices = await tx
      .select()
      .from(schema.rotaNotice)
      .where(and(eq(schema.rotaNotice.workerId, worker.id), isNull(schema.rotaNotice.seenAt)))
      .orderBy(asc(schema.rotaNotice.startsAt));
    return { now, lone, notices, shifts, breaks, clients, available, myClaims, leave, tips, policy: org?.policy ?? null, balance: balances.get(worker.id)!, year };
  });

  const days = new Map<string, typeof data.shifts>();
  for (const s of data.shifts) {
    const d = londonParts(s.startsAt.getTime()).date;
    days.set(d, [...(days.get(d) ?? []), s]);
  }
  const { balance } = data;
  const claimed = new Set(data.myClaims.map((c) => c.claim.shiftId));
  const pickUp = data.available
    .filter((s) => !claimed.has(s.id))
    .map((s) => ({
      id: s.id,
      when: `${longDate(londonParts(s.startsAt.getTime()).date)}, ${timeFmt.format(s.startsAt)} to ${timeFmt.format(s.endsAt)}`,
      detail: s.workerId ? "A colleague needs cover" : "Open shift",
    }));
  const unit = worker.irregularHours ? "hours" : "days";
  const { calm = false, largeText = false } = worker.preferences;
  const next = data.shifts.find((s) => s.endsAt.getTime() > data.now);
  const NOTICE_TEXT = {
    added: "New shift",
    cancelled: "Cancelled",
    given_to_you: "Now yours (you picked it up)",
    taken_by_colleague: "A colleague is covering this",
  } as const;

  return (
    <main className={`mx-auto w-full max-w-2xl px-4 py-12 ${largeText ? "text-lg" : ""}`}>
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Hello, {user.name}</h1>
          <p className="text-zinc-600 dark:text-zinc-400">{businessName}</p>
        </div>
        <SignOutButton />
      </div>

      {data.lone.map(({ shift, status, clientName, checks }) => (
        <section key={shift.id} aria-label="Working alone" className={`mt-6 rounded-lg border-2 p-4 ${status.state === "help" ? "border-red-600" : "border-zinc-900 dark:border-zinc-100"}`}>
          <h2 className="text-lg font-semibold">You are working alone{clientName ? ` with ${clientName}` : ""}</h2>
          <p className="mt-1">
            {timeFmt.format(shift.startsAt)} to {timeFmt.format(shift.endsAt)}.{" "}
            {status.state === "finished"
              ? ""
              : status.state === "help"
              ? "You asked for help. Your manager has been alerted."
              : status.dueAt
                ? `Next check-in by ${timeFmt.format(new Date(status.dueAt))}.`
                : ""}
          </p>
          {status.state === "finished" ? (
            <p role="status" className="mt-2 font-medium">
              You checked out safely at {timeFmt.format(checks.find((c) => c.kind === "finished")!.createdAt)}.
            </p>
          ) : (
            <LoneCheckIn shiftId={shift.id} started={checks.some((c) => c.kind !== "resolved")} />
          )}
        </section>
      ))}

      {data.notices.length > 0 && (
        <section className="mt-6 rounded-lg border-2 border-zinc-900 p-4 dark:border-zinc-100" aria-labelledby="changes-heading">
          <h2 id="changes-heading" className="text-lg font-semibold">What has changed in your rota</h2>
          <ul className="mt-2 flex flex-col gap-2">
            {data.notices.map((n) => (
              <li key={n.id}>
                <strong>{NOTICE_TEXT[n.kind]}:</strong> {longDate(londonParts(n.startsAt.getTime()).date)}, {timeFmt.format(n.startsAt)} to{" "}
                {timeFmt.format(n.endsAt)}.
                {n.noticeHours < SHORT_NOTICE_HOURS && n.kind !== "given_to_you" && (
                  <span className="block text-sm text-zinc-600 dark:text-zinc-400">
                    Short notice: {n.kind === "added" ? "added" : "changed"} {n.noticeHours < 48 ? `${n.noticeHours} hours` : `${Math.floor(n.noticeHours / 24)} days`} before the
                    shift. Speak to your manager if this causes you a problem.
                  </span>
                )}
              </li>
            ))}
          </ul>
          <form action={markNoticesSeen} className="mt-3">
            <button type="submit" className="rounded-lg border border-zinc-400 px-4 py-2">Got it</button>
          </form>
        </section>
      )}

      {next && (
        <p className="mt-6 rounded-lg bg-zinc-100 p-4 dark:bg-zinc-900">
          <span className="block text-sm text-zinc-600 dark:text-zinc-400">{next.startsAt.getTime() <= data.now ? "Now" : "Your next shift"}</span>
          <span className="text-xl font-semibold">
            {longDate(londonParts(next.startsAt.getTime()).date)}, {timeFmt.format(next.startsAt)} to {timeFmt.format(next.endsAt)}
          </span>
        </p>
      )}

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
                      {s.startsAt.getTime() > data.now && (
                        <form action={setCoverRequest} className="mt-1">
                          <input type="hidden" name="shiftId" value={s.id} />
                          <input type="hidden" name="wanted" value={String(!s.coverRequestedAt)} />
                          {s.coverRequestedAt && <span className="text-sm">You have asked for cover. You keep this shift until your manager agrees a swap. </span>}
                          <button type="submit" className="text-sm underline">{s.coverRequestedAt ? "Cancel cover request" : "Ask for someone to cover"}</button>
                        </form>
                      )}
                    </div>
                  );
                })}
              </li>
            ))}
          </ul>
        )}
        <a href="/me/calendar.ics" className="mt-3 inline-block underline">Add your shifts to your phone or computer calendar</a>
      </section>

      <More calm={calm}>
      {(pickUp.length > 0 || data.myClaims.length > 0) && (
        <section className="mt-10" aria-labelledby="pickup-heading">
          <h2 id="pickup-heading" className="text-lg font-semibold">Shifts you could pick up</h2>
          {data.myClaims.length > 0 && (
            <ul className="mt-2 flex flex-col gap-1">
              {data.myClaims.map(({ claim, shift }) => (
                <li key={claim.id} className="flex flex-wrap items-center gap-3">
                  <span>
                    You asked for {longDate(londonParts(shift.startsAt.getTime()).date)}, {timeFmt.format(shift.startsAt)} to {timeFmt.format(shift.endsAt)}. Waiting for your manager.
                  </span>
                  <form action={withdrawClaim}>
                    <input type="hidden" name="id" value={claim.id} />
                    <button type="submit" className="text-sm underline">Withdraw</button>
                  </form>
                </li>
              ))}
            </ul>
          )}
          {/* Kept mounted after the last shift is asked for, so the confirmation stays on screen. */}
          <PickUpList shifts={pickUp} />
        </section>
      )}

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

      {(data.tips.length > 0 || data.policy) && (
        <section className="mt-10" aria-labelledby="tips-heading">
          <h2 id="tips-heading" className="text-lg font-semibold">Your tips</h2>
          {data.tips.length === 0 ? (
            <p className="mt-2">No tips shared with you yet.</p>
          ) : (
            <ul className="mt-2 flex flex-col gap-1">
              {data.tips.map((t) => (
                <li key={t.id}>
                  {shortDate(t.allocation.periodFrom)} to {shortDate(t.allocation.periodTo)}: <strong>£{(t.pence / 100).toFixed(2)}</strong> for {t.hours} hours
                  <span className="text-zinc-600 dark:text-zinc-400">
                    {t.allocation.paidAt ? " · paid" : ` · to be paid by ${shortDate(t.allocation.payBy)}`}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {data.policy && (
            <details className="mt-3">
              <summary className="cursor-pointer underline">How tips are shared here</summary>
              <p className="mt-2 whitespace-pre-line rounded-md bg-zinc-100 p-3 text-sm dark:bg-zinc-900">{data.policy}</p>
            </details>
          )}
        </section>
      )}

      <section className="mt-10" aria-labelledby="ask-heading">
        <h2 id="ask-heading" className="text-lg font-semibold">Ask for time off</h2>
        <TimeOffForm unit={unit} kinds={LEAVE_KINDS.map((k) => ({ value: k, label: LEAVE_LABEL[k] }))} />
      </section>
      </More>

      <section className="mt-10" aria-labelledby="concern-heading">
        <h2 id="concern-heading" className="text-lg font-semibold">Worried about something?</h2>
        <p className="mt-1">
          If you are worried about someone&apos;s safety or how things are done at work, you can tell a manager privately, with or
          without your name.
        </p>
        <Link href="/me/concern" className="mt-2 inline-block rounded-lg border border-zinc-400 px-4 py-2">Raise a concern</Link>
      </section>

      <section className="mt-10" aria-labelledby="view-heading">
        <h2 id="view-heading" className="text-lg font-semibold">How this page looks</h2>
        <form action={savePreferences} className="mt-2 flex flex-col gap-3">
          <label className="flex items-start gap-2">
            <input type="checkbox" name="calm" defaultChecked={calm} className="mt-1" />
            <span>
              Calm mode
              <span className="block text-sm text-zinc-600 dark:text-zinc-400">Shows your shifts and any changes first, and puts everything else under &ldquo;More&rdquo;.</span>
            </span>
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" name="largeText" defaultChecked={largeText} /> Larger text
          </label>
          <button type="submit" className="self-start rounded-lg border border-zinc-400 px-4 py-2">Save</button>
        </form>
      </section>
    </main>
  );
}
