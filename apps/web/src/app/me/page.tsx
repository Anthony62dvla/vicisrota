import { addDays, courseSite, londonDateTime, londonParts, nextClockActions } from "@vicisrota/compliance";
import { schema, withOrganisation } from "@vicisrota/db";
import { and, asc, desc, eq, gt, gte, inArray, isNotNull, isNull, lt, ne, or } from "drizzle-orm";
import Link from "next/link";
import type { ReactNode } from "react";
import { requireStaff } from "@/lib/business";
import { db } from "@/lib/db";
import { formatAmount, LEAVE_LABEL, leaveChoices, loadBalances } from "@/lib/leave";
import { clockableShifts } from "@/lib/clock";
import { loadLoneShifts } from "@/lib/lone-working";
import { SHORT_NOTICE_HOURS } from "@/lib/notices";
import { todayInUk } from "@/lib/rota";
import { loadSickness } from "@/lib/sickness";
import { activeRollCall } from "@/lib/roll-call";
import { pendingCheckIns } from "@/lib/wellbeing";
import { loadOpenSwaps, shiftWhen } from "@/lib/swaps";
import { SwapAnswer } from "./swap/swap-answer";
import { withdrawSwap } from "./swap/actions";
import { iAmSafe } from "../roll-call/actions";
import { addMyUnavailable, markNoticesSeen, readAnnouncement, removeMyUnavailable, savePreferences, setCoverRequest, withdrawClaim, withdrawRequest } from "./actions";
import { formatUkMobile } from "@vicisrota/messaging";
import { tellsChanges, wantsTexts } from "@vicisrota/messaging";
import { pushPublicKey } from "@/lib/push";
import { PushSwitch } from "../push-switch";
import { ClockButtons, LoneCheckIn, PickUpList, PinForm, ReportSickForm, TextSettingsForm, TimeOffForm } from "./forms";
import { OfflineNotice } from "./offline-notice";
import { localeOf } from "@vicisrota/messaging";
import { messagesFor } from "@/lib/i18n";
import { getLang } from "@/lib/i18n/server";
import { AvailabilityEditor } from "../availability-editor";
import { adjustmentLines } from "@/lib/availability-labels";

const MINUTE = 60_000;
/** How far ahead staff can see published shifts. */
const WEEKS_AHEAD = 4;
const timeFmt = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const sentFmt = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
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
  const lang = await getLang();
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
    // Who else is working at the same time, so nobody walks in not knowing who they will be with.
    // First names and roles only.
    const colleagues = shifts.length
      ? await tx
          .select({ startsAt: schema.shift.startsAt, endsAt: schema.shift.endsAt, roleId: schema.shift.roleId, name: schema.worker.fullName })
          .from(schema.shift)
          .innerJoin(schema.worker, eq(schema.shift.workerId, schema.worker.id))
          .where(
            and(
              eq(schema.shift.status, "published"),
              ne(schema.shift.workerId, worker.id),
              lt(schema.shift.startsAt, shifts.at(-1)!.endsAt),
              gt(schema.shift.endsAt, shifts[0]!.startsAt),
            ),
          )
          .orderBy(asc(schema.shift.startsAt))
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
          // Only shifts with no role, or a role this person is set up for.
          or(
            isNull(schema.shift.roleId),
            inArray(schema.shift.roleId, tx.select({ id: schema.workerRole.roleId }).from(schema.workerRole).where(eq(schema.workerRole.workerId, worker.id))),
          ),
        ),
      )
      .orderBy(asc(schema.shift.startsAt));
    const roles = await tx.select().from(schema.jobRole);
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
    // A fire or emergency roll call that includes them.
    const call = await activeRollCall(tx);
    const rollCall = call
      ? ((
          await tx
            .select({ safeAt: schema.rollCallPerson.safeAt })
            .from(schema.rollCallPerson)
            .where(and(eq(schema.rollCallPerson.rollCallId, call.id), eq(schema.rollCallPerson.workerId, worker.id)))
        )[0] ?? null)
      : null;
    // Pay for their shifts cancelled, moved or cut short at short notice, in the last 13 weeks and still to come.
    const shortNotice = await tx
      .select()
      .from(schema.shortNoticePayment)
      .where(
        and(
          eq(schema.shortNoticePayment.workerId, worker.id),
          isNull(schema.shortNoticePayment.waivedAt),
          gte(schema.shortNoticePayment.shiftStartsAt, new Date(londonDateTime(addDays(today, -91), "00:00"))),
        ),
      )
      .orderBy(desc(schema.shortNoticePayment.shiftStartsAt));
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
    const clockable = await clockableShifts(tx, worker.id, now);
    const [locationRule] = await tx.select({ rule: schema.organisation.clockLocationRule }).from(schema.organisation).where(eq(schema.organisation.id, organisationId));
    const mappedWorkplaces = await tx.select({ id: schema.location.id }).from(schema.location).where(isNotNull(schema.location.latitude));
    const checksLocation = locationRule?.rule !== "off" && mappedWorkplaces.length > 0;
    const hasKiosk = (await tx.select({ id: schema.kioskDevice.id }).from(schema.kioskDevice).where(and(eq(schema.kioskDevice.organisationId, organisationId), isNull(schema.kioskDevice.revokedAt))).limit(1)).length > 0;
    const unavailable = await tx
      .select()
      .from(schema.workerUnavailability)
      .where(eq(schema.workerUnavailability.workerId, worker.id))
      .orderBy(asc(schema.workerUnavailability.weekday), asc(schema.workerUnavailability.startsAt));
    const announcements = await tx
      .select({ post: schema.announcement, readAt: schema.announcementRead.readAt })
      .from(schema.announcement)
      .leftJoin(
        schema.announcementRead,
        and(eq(schema.announcementRead.announcementId, schema.announcement.id), eq(schema.announcementRead.workerId, worker.id)),
      )
      .where(isNull(schema.announcement.archivedAt))
      .orderBy(desc(schema.announcement.createdAt))
      .limit(20);
    const checkIns = await pendingCheckIns(tx, worker.id, now);
    const training = await tx
      .select({ id: schema.workerQualification.id, qualificationId: schema.qualification.id, name: schema.qualification.name, expiresOn: schema.workerQualification.expiresOn, courseUrl: schema.qualification.courseUrl })
      .from(schema.workerQualification)
      .innerJoin(schema.qualification, eq(schema.workerQualification.qualificationId, schema.qualification.id))
      .where(eq(schema.workerQualification.workerId, worker.id))
      .orderBy(asc(schema.qualification.name));
    const courses = await tx
      .select({ id: schema.qualification.id, name: schema.qualification.name, courseUrl: schema.qualification.courseUrl })
      .from(schema.qualification)
      .where(isNotNull(schema.qualification.courseUrl))
      .orderBy(asc(schema.qualification.name));
    const recentMessages = await tx
      .select({ id: schema.notification.id, title: schema.notification.title, body: schema.notification.body, createdAt: schema.notification.createdAt })
      .from(schema.notification)
      .where(eq(schema.notification.workerId, worker.id))
      .orderBy(desc(schema.notification.createdAt))
      .limit(5);
    const sick = (await loadSickness(tx, addDays(today, 366), [worker.id])).get(worker.id);
    const sickPay = new Map((sick?.records ?? []).filter((r) => !r.ssp.oldRules && r.ssp.pence > 0).map((r) => [r.id, r.ssp.pence]));
    const swaps = await loadOpenSwaps(tx, worker.id);
    const [statement] = await tx
      .select({ issuedAt: schema.writtenStatement.issuedAt, readAt: schema.writtenStatement.readAt })
      .from(schema.writtenStatement)
      .where(eq(schema.writtenStatement.workerId, worker.id))
      .orderBy(desc(schema.writtenStatement.issuedAt))
      .limit(1);
    return { statement, swaps, checkIns, training, courses, recentMessages, colleagues, roles, sickPay, announcements, unavailable, now, lone, notices, clockable, checksLocation, hasKiosk, shifts, breaks, clients, available, myClaims, leave, tips, shortNotice, rollCall, policy: org?.policy ?? null, balance: balances.get(worker.id)!, year };
  });

  const days = new Map<string, typeof data.shifts>();
  for (const s of data.shifts) {
    const d = londonParts(s.startsAt.getTime()).date;
    days.set(d, [...(days.get(d) ?? []), s]);
  }
  const { balance } = data;
  const claimed = new Set(data.myClaims.map((c) => c.claim.shiftId));
  const roleName = new Map(data.roles.map((r) => [r.id, r.name]));
  const pickUp = data.available
    .filter((s) => !claimed.has(s.id))
    .map((s) => ({
      id: s.id,
      when: `${longDate(londonParts(s.startsAt.getTime()).date)}, ${timeFmt.format(s.startsAt)} to ${timeFmt.format(s.endsAt)}`,
      detail: `${s.workerId ? "A colleague needs cover" : "Open shift"}${s.roleId && roleName.has(s.roleId) ? ` · ${roleName.get(s.roleId)}` : ""}`,
    }));
  const unit = worker.irregularHours ? "hours" : "days";
  const { calm = false, largeText = false } = worker.preferences;
  const pushKey = pushPublicKey();
  const next = data.shifts.find((s) => s.endsAt.getTime() > data.now);
  const SHORT_NOTICE_KIND = { cancelled: "cancelled", moved: "moved", shortened: "cut short" } as const;
  const NOTICE_TEXT = {
    added: "New shift",
    changed: "Changed",
    cancelled: "Cancelled",
    given_to_you: "Now yours (you picked it up)",
    taken_by_colleague: "A colleague is covering this",
  } as const;

  // Shown on the copy saved on their phone, so they know how old it is when there is no signal.
  const updatedAt = `${timeFmt.format(data.now)} on ${shortDate(londonParts(data.now).date)}`;

  return (
    <main className={`mx-auto w-full max-w-2xl px-4 py-8 lg:px-8 ${largeText ? "text-lg" : ""}`}>
      {data.rollCall && (
        <section role="alert" className="mb-6 rounded-lg border-4 border-red-600 p-4" aria-labelledby="roll-call-heading">
          <h2 id="roll-call-heading" className="text-xl font-semibold">Roll call</h2>
          {data.rollCall.safeAt ? (
            <p className="mt-1">Thank you. Your manager knows you are safe.</p>
          ) : (
            <>
              <p className="mt-1">Your manager is checking everyone is safe. If you are out of the building and safe, tap the button.</p>
              <form action={iAmSafe} className="mt-3">
                <button type="submit" className="w-full rounded-lg bg-green-700 px-6 py-4 text-xl font-semibold text-white hover:bg-green-800">I&apos;m safe</button>
              </form>
            </>
          )}
        </section>
      )}
      <h1 className="text-2xl font-semibold">Hello, {user.name}</h1>
      <p className="text-zinc-600 dark:text-zinc-400">{businessName}</p>
      <p className="mt-1 text-sm">
        {/* Each word in its own language, so someone who does not read English can still find it. */}
        <Link href="/display?back=/me#language-heading" className="underline">
          Language · <span lang="cy">Iaith</span> · <span lang="pl">Język</span> · <span lang="ro">Limba</span>
        </Link>
      </p>
      {lang !== "en" && (
        <p lang={localeOf(lang)} className="mt-3">
          <Link href="/me/easy-read" className="inline-block rounded-lg border-2 border-brand px-4 py-2 font-medium text-heading">
            {messagesFor(lang).me.inYourLanguage}
          </Link>
        </p>
      )}

      <OfflineNotice updatedAt={updatedAt} />

      {data.checkIns.length > 0 && (
        <section className="mt-6 rounded-lg border-2 border-brand p-4" aria-labelledby="checkin-heading">
          <h2 id="checkin-heading" className="text-lg font-semibold">How was your shift?</h2>
          <p className="mt-1">A quick, private check-in that you asked for. Skip it if you like.</p>
          <Link href="/me/wellbeing" className="mt-3 inline-block rounded-lg bg-brand px-4 py-2 text-on-brand hover:bg-brand-hover">
            Check in
          </Link>
        </section>
      )}

      {data.clockable.map(({ shift, summary }) => (
        <section key={`clock-${shift.id}`} aria-label="Clock in and out" className="mt-6 rounded-lg border-2 border-brand p-4">
          <h2 className="text-lg font-semibold">
            {summary.state === "not_in" ? "Your shift" : summary.state === "out" ? "Shift finished" : summary.state === "on_break" ? "On a break" : "Clocked in"}
          </h2>
          <p className="mt-1">
            {longDate(londonParts(shift.startsAt.getTime()).date)}, {timeFmt.format(shift.startsAt)} to {timeFmt.format(shift.endsAt)}.
            {summary.clockedIn !== null && ` You clocked in at ${timeFmt.format(new Date(summary.clockedIn))}.`}
            {summary.breakMinutes > 0 && ` Break so far: ${summary.breakMinutes} minute${summary.breakMinutes === 1 ? "" : "s"}.`}
            {summary.clockedOut !== null && ` You clocked out at ${timeFmt.format(new Date(summary.clockedOut))}.`}
          </p>
          <ClockButtons shiftId={shift.id} actions={nextClockActions(summary.state)} askLocation={data.checksLocation} />
          {data.checksLocation && summary.state !== "out" && (
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              Your phone&apos;s location is checked only at the moment you tap, to confirm you are at work. Only the distance from work is
              saved, never where you were.
            </p>
          )}
          <Link href="/me/checklist" className="mt-3 inline-block underline">
            Today&rsquo;s checklist and handover
          </Link>
        </section>
      ))}

      {data.lone.map(({ shift, status, clientName, checks }) => (
        <section key={shift.id} aria-label="Working alone" className={`mt-6 rounded-lg border-2 p-4 ${status.state === "help" ? "border-red-600" : "border-brand"}`}>
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

      {data.announcements
        .filter((a) => !a.readAt)
        .map(({ post }) => (
          <section key={post.id} className="mt-6 rounded-lg border-2 border-sky-700 p-4" aria-labelledby={`announcement-${post.id}`}>
            <p className="text-sm font-medium text-sky-800 dark:text-sky-300">Message from {businessName}</p>
            <h2 id={`announcement-${post.id}`} className="text-lg font-semibold">{post.title}</h2>
            <p className="mt-2 whitespace-pre-line">{post.body}</p>
            <form action={readAnnouncement} className="mt-3">
              <input type="hidden" name="id" value={post.id} />
              <button type="submit" className="rounded-lg border border-zinc-400 px-4 py-2">
                {post.needsConfirmation ? "I have read and understood this" : "Got it"}
              </button>
            </form>
          </section>
        ))}

      {data.notices.length > 0 && (
        <section className="mt-6 rounded-lg border-2 border-brand p-4" aria-labelledby="changes-heading">
          <h2 id="changes-heading" className="text-lg font-semibold">What has changed in your rota</h2>
          <ul className="mt-2 flex flex-col gap-2">
            {data.notices.map((n) => (
              <li key={n.id}>
                <strong>{NOTICE_TEXT[n.kind]}:</strong> {longDate(londonParts(n.startsAt.getTime()).date)}, {timeFmt.format(n.startsAt)} to{" "}
                {timeFmt.format(n.endsAt)}.
                {data.shortNotice
                  .filter((p) => p.shiftId === n.shiftId && n.kind !== "added" && n.kind !== "given_to_you")
                  .map((p) => (
                    <span key={p.id} className="block text-sm">
                      Because this was short notice, you will be paid <strong>£{(p.pence / 100).toFixed(2)}</strong> for the time you lose.
                    </span>
                  ))}
                {n.noticeHours < SHORT_NOTICE_HOURS && n.kind !== "given_to_you" && (
                  <span className="block text-sm text-zinc-600 dark:text-zinc-400">
                    Short notice: {n.kind === "added" ? "added" : "changed"} {n.noticeHours < 48 ? `${n.noticeHours} hours` : `${Math.floor(n.noticeHours / 24)} days`} before the
                    shift. If this is hard to fit around, it is fine to tell your manager.
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

      <details className="mt-6 rounded-lg border border-zinc-300 p-4 dark:border-zinc-700">
        <summary className="cursor-pointer font-medium">Off sick?</summary>
        <ReportSickForm />
      </details>

      <section className="mt-8" aria-labelledby="shifts-heading">
        <h2 id="shifts-heading" className="text-lg font-semibold">Your shifts</h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Published shifts for the next {WEEKS_AHEAD} weeks. Times are UK time.</p>
        {days.size === 0 ? (
          <p className="mt-3">You have no published shifts coming up. Your manager publishes the rota each week.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-3">
            {[...days].map(([d, shifts]) => (
              <li key={d} className={`rounded-lg border p-3 ${d === today ? "border-brand" : "border-zinc-300 dark:border-zinc-700"}`}>
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
                        {s.roleId && roleName.has(s.roleId) && <strong>{` · ${roleName.get(s.roleId)}`}</strong>}
                        {s.kind === "sleep_in" && <strong> · Sleep-in</strong>}
                        {s.kind === "waking_night" && <strong> · Waking night</strong>}
                        <span className="text-zinc-600 dark:text-zinc-400">
                          {" "}· {Number.isInteger(paidHours) ? paidHours : paidHours.toFixed(2).replace(/0$/, "")} {paidHours === 1 ? "hour" : "hours"}
                          {unpaid > 0 && `, ${Math.round(unpaid / MINUTE)} minute break`}
                        </span>
                      </p>
                      {s.splitGroupId && shifts.filter((p) => p.splitGroupId === s.splitGroupId).length > 1 && (
                        <p className="text-sm">
                          Split shift, part {shifts.filter((p) => p.splitGroupId === s.splitGroupId).findIndex((p) => p.id === s.id) + 1} of{" "}
                          {shifts.filter((p) => p.splitGroupId === s.splitGroupId).length}. The time in between is your own. Clock in and out for each part.
                        </p>
                      )}
                      {client?.postcode && <p className="text-sm">{client.postcode}</p>}
                      {s.kind === "sleep_in" && (
                        <p className="text-sm">You sleep at work and are woken only if needed. You get the sleep-in payment, plus your hourly rate for any time woken to work. Tell your manager how long you were up.</p>
                      )}
                      {s.travelMinutes > 0 && <p className="text-sm">Allow {s.travelMinutes} minutes to travel from your previous visit.</p>}
                      {client?.visitNotes && <p className="mt-1 rounded-md bg-zinc-100 p-2 text-sm dark:bg-zinc-900">{client.visitNotes}</p>}
                      {s.note && <p className="mt-1 rounded-md bg-brand-soft p-2 text-sm whitespace-pre-line">{s.note}</p>}
                      {(() => {
                        const withYou = [
                          ...new Set(
                            data.colleagues
                              .filter((c) => c.startsAt < s.endsAt && c.endsAt > s.startsAt)
                              .map((c) => `${c.name.split(" ")[0]}${c.roleId && roleName.has(c.roleId) ? ` (${roleName.get(c.roleId)})` : ""}`),
                          ),
                        ];
                        return withYou.length > 0 && <p className="text-sm">Working with you: {withYou.join(", ")}</p>;
                      })()}
                      {s.startsAt.getTime() > data.now && (
                        <form action={setCoverRequest} className="mt-1">
                          <input type="hidden" name="shiftId" value={s.id} />
                          <input type="hidden" name="wanted" value={String(!s.coverRequestedAt)} />
                          {s.coverRequestedAt && <span className="text-sm">You have asked for cover. You keep this shift until your manager agrees a swap. </span>}
                          <button type="submit" className="text-sm underline">{s.coverRequestedAt ? "Cancel cover request" : "Ask for someone to cover"}</button>
                          {!data.swaps.some((w) => w.swap.fromShiftId === s.id) && (
                            <>
                              {" · "}
                              <Link href={`/me/swap/${s.id}`} className="text-sm underline">Swap with a named colleague</Link>
                            </>
                          )}
                        </form>
                      )}
                    </div>
                  );
                })}
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
          <Link href="/me/easy-read" className="underline">See your shifts in Easy Read, with pictures and read aloud</Link>
          <a href="/me/calendar.ics" className="underline">Add your shifts to your phone or computer calendar</a>
        </p>
      </section>

      {data.swaps.length > 0 && (
        <section className="mt-8 rounded-lg border-2 border-brand p-4" aria-labelledby="swaps-heading">
          <h2 id="swaps-heading" className="text-lg font-semibold">Swaps</h2>
          <ul className="mt-2 flex flex-col gap-3">
            {data.swaps.map(({ swap, fromShift, toShift, fromName, toName }) =>
              swap.fromWorkerId === worker.id ? (
                <li key={swap.id}>
                  <p>
                    You asked {toName.split(" ")[0]} to swap: you take {shiftWhen(toShift)}, they take {shiftWhen(fromShift)}.{" "}
                    {swap.status === "asked" ? `Waiting for ${toName.split(" ")[0]} to answer.` : "They said yes. Waiting for your manager."}
                  </p>
                  <form action={withdrawSwap}>
                    <input type="hidden" name="swapId" value={swap.id} />
                    <button type="submit" className="text-sm underline">Withdraw this request</button>
                  </form>
                </li>
              ) : (
                <li key={swap.id}>
                  <p>
                    {fromName.split(" ")[0]} would like to swap: you take <strong>{shiftWhen(fromShift)}</strong>, and they take your shift on{" "}
                    <strong>{shiftWhen(toShift)}</strong>.
                  </p>
                  {swap.note && <p className="mt-1 rounded-md bg-brand-soft p-2 text-sm whitespace-pre-line">{swap.note}</p>}
                  {swap.status === "asked" ? (
                    <SwapAnswer swapId={swap.id} />
                  ) : (
                    <p className="text-sm">You said yes. Waiting for your manager. You keep your own shift until they approve it.</p>
                  )}
                </li>
              ),
            )}
          </ul>
        </section>
      )}

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
                  <p className="text-sm">
                    {STATUS[l.status]}
                    {data.sickPay.has(l.id) && ` · Statutory Sick Pay £${(data.sickPay.get(l.id)! / 100).toFixed(2)}`}
                  </p>
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

      {data.shortNotice.length > 0 && (
        <section className="mt-10" aria-labelledby="short-notice-heading">
          <h2 id="short-notice-heading" className="text-lg font-semibold">Short-notice pay</h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            When your manager changes a published shift at short notice, you are paid for the time you lose. It is added to your pay for that week.
          </p>
          <ul className="mt-2 flex flex-col gap-1">
            {data.shortNotice.map((p) => (
              <li key={p.id}>
                {longDate(londonParts(p.shiftStartsAt.getTime()).date)}, {timeFmt.format(p.shiftStartsAt)} to {timeFmt.format(p.shiftEndsAt)}:{" "}
                <strong>£{(p.pence / 100).toFixed(2)}</strong>
                <span className="text-zinc-600 dark:text-zinc-400"> · {SHORT_NOTICE_KIND[p.kind]}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

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
        <TimeOffForm unit={unit} kinds={leaveChoices()} />
      </section>
      {data.announcements.some((a) => a.readAt) && (
        <section className="mt-10" aria-labelledby="past-announcements-heading">
          <h2 id="past-announcements-heading" className="text-lg font-semibold">Messages you have read</h2>
          <ul className="mt-2 flex flex-col gap-2">
            {data.announcements
              .filter((a) => a.readAt)
              .map(({ post }) => (
                <li key={post.id}>
                  <details>
                    <summary className="cursor-pointer">{post.title}</summary>
                    <p className="mt-1 whitespace-pre-line">{post.body}</p>
                  </details>
                </li>
              ))}
          </ul>
        </section>
      )}

      <section className="mt-10" aria-labelledby="availability-heading">
        <h2 id="availability-heading" className="text-lg font-semibold">Times you can&apos;t work</h2>
        <p className="mt-1">For example school runs, caring, study or another job. Your manager is warned before giving you a shift at these times.</p>
        <AvailabilityEditor slots={data.unavailable} add={addMyUnavailable} remove={removeMyUnavailable} you />
        {adjustmentLines(worker.adjustments).length > 0 && (
          <>
            <h3 className="mt-6 font-medium">Adjustments agreed with you</h3>
            <ul className="mt-1 list-disc pl-6">
              {adjustmentLines(worker.adjustments).map((l) => <li key={l}>{l}</li>)}
            </ul>
            {worker.adjustments.note && <p className="mt-2 text-zinc-700 dark:text-zinc-300">{worker.adjustments.note}</p>}
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">Your manager is warned about any shift that does not fit these. If something needs to change, talk to them.</p>
          </>
        )}
      </section>
      </More>

      <section className="mt-10" aria-labelledby="concern-heading">
        <h2 id="concern-heading" className="text-lg font-semibold">Worried about something?</h2>
        <p className="mt-1">
          Worried about someone&apos;s safety, or how things are done at work? You can tell a manager in private. You do not have to give your name.
        </p>
        <Link href="/me/concern" className="mt-2 inline-block rounded-lg border border-zinc-400 px-4 py-2">Raise a concern</Link>
      </section>

      {data.hasKiosk && (
        <section className="mt-10" aria-labelledby="pin-heading">
          <h2 id="pin-heading" className="text-lg font-semibold">Clock-in PIN</h2>
          <PinForm hasPin={!!worker.pinHash} />
        </section>
      )}

      {(data.training.length > 0 || data.courses.length > 0) && (
        <section className="mt-10" aria-labelledby="training-heading">
          <h2 id="training-heading" className="text-lg font-semibold">Your training</h2>
          {data.training.length > 0 && (
            <ul className="mt-2 flex flex-col gap-2">
              {data.training.map((t) => {
                const expired = !!t.expiresOn && t.expiresOn < today;
                const soon = !!t.expiresOn && !expired && t.expiresOn <= addDays(today, 30);
                return (
                  <li key={t.id} className={`rounded-lg border p-3 ${expired ? "border-amber-500" : "border-zinc-300 dark:border-zinc-700"}`}>
                    <p className="font-medium">{t.name}</p>
                    {t.expiresOn && (
                      <p className="text-sm">
                        {expired ? `Ran out on ${yearDate(t.expiresOn)}. Please renew it.` : `In date until ${yearDate(t.expiresOn)}.${soon ? " Time to renew it soon." : ""}`}
                      </p>
                    )}
                    {t.courseUrl && <CourseLink url={t.courseUrl} label={expired || soon ? "Renew it on" : "Course on"} />}
                  </li>
                );
              })}
            </ul>
          )}
          {data.courses.some((c) => !data.training.some((t) => t.qualificationId === c.id)) && (
            <>
              <p className="mt-4 font-medium">{data.training.length > 0 ? "Other courses from your workplace" : "Courses from your workplace"}</p>
              <ul className="mt-2 flex flex-col gap-2">
                {data.courses
                  .filter((c) => !data.training.some((t) => t.qualificationId === c.id))
                  .map((c) => (
                    <li key={c.id} className="rounded-lg border border-zinc-300 p-3 dark:border-zinc-700">
                      <p className="font-medium">{c.name}</p>
                      <CourseLink url={c.courseUrl!} label="Course on" />
                    </li>
                  ))}
              </ul>
            </>
          )}
        </section>
      )}

      {data.statement && (
        <section className={`mt-10 ${data.statement.readAt ? "" : "rounded-lg border-2 border-brand p-4"}`} aria-labelledby="statement-heading">
          <h2 id="statement-heading" className="text-lg font-semibold">Your written statement</h2>
          <p className="mt-1">
            {data.statement.readAt
              ? "The main terms of your job: your pay, hours, holiday and notice."
              : "Your manager has given you a written statement of the main terms of your job. Please read it."}
          </p>
          <Link href="/me/statement" className="mt-2 inline-block rounded-lg border border-zinc-400 px-4 py-2">
            {data.statement.readAt ? "See your statement" : "Read your statement"}
          </Link>
        </section>
      )}

      <section className="mt-10" aria-labelledby="profile-heading">
        <h2 id="profile-heading" className="text-lg font-semibold">How I work best</h2>
        <p className="mt-1">
          Say what you bring, what helps you at work and how you like to be contacted. It is private unless you choose to share it with your
          managers{worker.workProfile.shared ? ", which you have" : ""}.
        </p>
        <Link href="/me/profile" className="mt-2 inline-block rounded-lg border border-zinc-400 px-4 py-2">
          {Object.keys(worker.workProfile).some((k) => k !== "shared") ? "See or change yours" : "Fill it in"}
        </Link>
      </section>

      <section className="mt-10" aria-labelledby="data-heading">
        <h2 id="data-heading" className="text-lg font-semibold">Your data</h2>
        <p className="mt-1">
          Download a copy of everything VicisRota holds about you, such as your shifts, hours, pay rates, holiday and training. You can keep it or take it to
          another employer.
        </p>
        <a href="/me/data" className="mt-2 inline-block rounded-lg border border-zinc-400 px-4 py-2">Download my data</a>
        <p className="mt-2 text-sm text-muted">
          If you leave, most of your details are deleted 2 years later, and everything else after 6 years. Read the{" "}
          <Link href="/privacy#keep" className="underline">privacy policy</Link> for the details.
        </p>
      </section>

      <section className="mt-10" aria-labelledby="texts-heading">
        <h2 id="texts-heading" className="text-lg font-semibold">Notifications and reminders</h2>
        <p className="mt-1">Changes always show on this page. You can also have them sent to your phone.</p>
        {pushKey ? (
          <PushSwitch publicKey={pushKey} />
        ) : (
          <p className="mt-2 text-muted">App notifications are not switched on for VicisRota yet, so for now messages come by text if you choose it.</p>
        )}
        <TextSettingsForm
          mobile={worker.mobile ? formatUkMobile(worker.mobile) : null}
          textChanges={tellsChanges(worker.preferences)}
          remindEvening={!!worker.preferences.remindEvening}
          remindBeforeMinutes={worker.preferences.remindBeforeMinutes ?? null}
          byText={wantsTexts(worker.preferences, worker.mobile)}
        />
        {data.recentMessages.length > 0 && (
          <details className="mt-4 rounded-lg border p-3">
            <summary className="font-medium">Messages we sent you recently</summary>
            <ul className="mt-2 flex flex-col gap-3">
              {data.recentMessages.map((m) => (
                <li key={m.id}>
                  <p className="text-sm text-muted">{sentFmt.format(m.createdAt)}</p>
                  <p className="font-medium">{m.title}</p>
                  <p className="whitespace-pre-line">{m.body}</p>
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>

      <section className="mt-10" aria-labelledby="install-heading">
        <h2 id="install-heading" className="text-lg font-semibold">Put VicisRota on your phone</h2>
        <p className="mt-1">It then opens like an app. Your shifts are saved on your phone, so you can see them even with no signal.</p>
        <ul className="mt-2 list-disc pl-6">
          <li>iPhone: open this page in Safari, tap Share, then &ldquo;Add to Home Screen&rdquo;.</li>
          <li>Android: open this page in Chrome, tap the menu (three dots), then &ldquo;Add to Home screen&rdquo; or &ldquo;Install app&rdquo;.</li>
        </ul>
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
          <p className="text-sm">
            More choices, such as your language, easier reading, softer colours and no movement, are in{" "}
            <Link href="/display?back=/me" className="underline">display settings</Link>.
          </p>
          <button type="submit" className="self-start rounded-lg border border-zinc-400 px-4 py-2">Save</button>
        </form>
        <p className="mt-6 text-sm text-zinc-600 dark:text-zinc-400">Updated at {updatedAt}.</p>
      </section>
    </main>
  );
}

/** Opens in a new tab and names the site, so people know where they are going before they tap. */
function CourseLink({ url, label }: { url: string; label: string }) {
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block underline">
      {label} {courseSite(url)}
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}

const yearDate = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-GB", { timeZone: "UTC", day: "numeric", month: "long", year: "numeric" });
