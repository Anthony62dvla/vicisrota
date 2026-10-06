import { addDays, evaluate, londonParts, weekCost, weekStart as mondayOf, type Finding } from "@vicisrota/compliance";
import { schema, withOrganisation } from "@vicisrota/db";
import { and, asc, desc, eq, gte, inArray, isNull, lt, lte, ne, or } from "drizzle-orm";
import Link from "next/link";
import { requireManager } from "@/lib/business";
import { db } from "@/lib/db";
import { LEAVE_LABEL } from "@/lib/leave";
import { candidatesFor, usualTimes } from "@/lib/board";
import { loadWeekChecks, todayInUk, weekBounds } from "@/lib/rota";
import { loadStaffingGaps } from "@/lib/staffing";
import { RotaBoard, type BoardShift } from "./board";
import { ClaimList, CopyWeekForm, FillOpenShiftsForm, PublishForm, SwapList } from "./forms";
import { loadOpenSwaps, shiftWhen } from "@/lib/swaps";

const timeFmt = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit" });
const dayFmt = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" });
const longFmt = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" });
const MINUTE = 60_000;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export default async function RotaPage({ searchParams }: PageProps<"/rota">) {
  const { organisationId, sector  } = await requireManager();
  const requested = (await searchParams).week;
  const today = todayInUk();
  const week = mondayOf(typeof requested === "string" && DATE.test(requested) ? requested : today);
  const days = Array.from({ length: 7 }, (_, i) => addDays(week, i));
  const { from, to } = weekBounds(week);

  const previous = weekBounds(addDays(week, -7));

  const { swaps, workers, training, clients, shifts, claims, leave, decision, rates, breaks, paysTravelTime, shortNoticeHours, lastWeek, roles, requirements, unavailable, workerRoles, recent, checks, gaps, sleepInPence } = await withOrganisation(db, organisationId, async (tx) => ({
    workers: await tx.select().from(schema.worker).where(or(isNull(schema.worker.leftOn), gte(schema.worker.leftOn, week))).orderBy(asc(schema.worker.fullName)),
    clients:
      sector === "care"
        ? await tx
            .select({ id: schema.client.id, name: schema.client.name, active: schema.client.active })
            .from(schema.client)
            .orderBy(asc(schema.client.name))
        : [],
    roles: await tx.select().from(schema.jobRole).orderBy(asc(schema.jobRole.name)),
    training: await tx.select({ id: schema.qualification.id, name: schema.qualification.name }).from(schema.qualification).orderBy(asc(schema.qualification.name)),
    shifts: await tx
      .select()
      .from(schema.shift)
      .where(and(gte(schema.shift.startsAt, from), lt(schema.shift.startsAt, to), ne(schema.shift.status, "cancelled")))
      .orderBy(asc(schema.shift.startsAt)),
    swaps: (await loadOpenSwaps(tx)).filter((r) => r.swap.status === "agreed"),
    claims: await tx
      .select({ claim: schema.shiftClaim, name: schema.worker.fullName })
      .from(schema.shiftClaim)
      .innerJoin(schema.worker, eq(schema.shiftClaim.workerId, schema.worker.id))
      .where(eq(schema.shiftClaim.status, "requested"))
      .orderBy(asc(schema.shiftClaim.createdAt)),
    leave: await tx
      .select()
      .from(schema.leaveRequest)
      .where(
        and(
          inArray(schema.leaveRequest.status, ["requested", "approved"]),
          lte(schema.leaveRequest.startsOn, days[6]!),
          gte(schema.leaveRequest.endsOn, days[0]!),
        ),
      ),
    rates: await tx.select().from(schema.payRate),
    requirements: await tx
      .select({ shiftId: schema.shiftRequirement.shiftId, qualificationId: schema.shiftRequirement.qualificationId })
      .from(schema.shiftRequirement)
      .innerJoin(schema.shift, eq(schema.shiftRequirement.shiftId, schema.shift.id))
      .where(and(gte(schema.shift.startsAt, from), lt(schema.shift.startsAt, to))),
    unavailable: await tx.select().from(schema.workerUnavailability),
    workerRoles: await tx.select().from(schema.workerRole),
    // The last five weeks of shifts give the business's usual start and finish times.
    recent: await tx
      .select({ startsAt: schema.shift.startsAt, endsAt: schema.shift.endsAt })
      .from(schema.shift)
      .where(and(gte(schema.shift.startsAt, weekBounds(addDays(week, -35)).from), lt(schema.shift.startsAt, to), ne(schema.shift.status, "cancelled"))),
    // Every rule is run on every page view, so problems show as the rota is built, not only at publishing.
    checks: await loadWeekChecks(tx, organisationId, week),
    gaps: await loadStaffingGaps(tx, week),
    breaks: await tx
      .select({ shiftId: schema.shiftBreak.shiftId, startsAt: schema.shiftBreak.startsAt, endsAt: schema.shiftBreak.endsAt })
      .from(schema.shiftBreak)
      .innerJoin(schema.shift, eq(schema.shiftBreak.shiftId, schema.shift.id))
      .where(and(gte(schema.shift.startsAt, from), lt(schema.shift.startsAt, to))),
    ...(await tx
      .select({ paysTravelTime: schema.organisation.paysTravelTime, shortNoticeHours: schema.organisation.shortNoticeHours, sleepInPence: schema.organisation.sleepInPence })
      .from(schema.organisation)
      .where(eq(schema.organisation.id, organisationId)))[0]!,
    lastWeek: (
      await tx
        .select({ id: schema.shift.id })
        .from(schema.shift)
        .where(and(gte(schema.shift.startsAt, previous.from), lt(schema.shift.startsAt, previous.to), ne(schema.shift.status, "cancelled")))
    ).length,
    decision: (
      await tx
        .select()
        .from(schema.complianceDecision)
        .where(eq(schema.complianceDecision.asOf, addDays(week, 6)))
        .orderBy(desc(schema.complianceDecision.checkedAt))
        .limit(1)
    )[0],
  }));
  const thisWeek = new Set(shifts.map((s) => s.id));
  const findings = evaluate(checks.context).findings.filter((f) => f.shiftIds.some((id) => thisWeek.has(id)));
  const clientName = new Map(clients.map((c) => [c.id, c.name]));
  const workerName = new Map(workers.map((w) => [w.id, w.fullName]));
  const claimed = new Set(claims.map((c) => c.claim.shiftId));
  // Requests for this week's shifts.
  const claimsShown = claims.flatMap((c) => {
    const shift = shifts.find((s) => s.id === c.claim.shiftId);
    return shift ? [{ ...c, shift }] : [];
  });
  const drafts = shifts.filter((s) => s.status === "draft").length;
  // Open drafts the rota builder can fill. Split shift parts are left for the manager.
  const openDrafts = shifts.filter((s) => !s.workerId && s.status === "draft" && !s.splitGroupId).length;
  const cost = weekCost(
    shifts.map((s) => ({
      id: s.id,
      workerId: s.workerId,
      start: s.startsAt.toISOString(),
      end: s.endsAt.toISOString(),
      travelMinutesBefore: s.travelMinutes,
      sleepIn: s.kind === "sleep_in" ? { awakeMinutes: 0 } : undefined,
      breaks: breaks.filter((b) => b.shiftId === s.id).map((b) => ({ start: b.startsAt.toISOString(), end: b.endsAt.toISOString() })),
    })),
    rates.map((r) => ({ workerId: r.workerId, hourlyPence: r.hourlyPence, effectiveFrom: r.effectiveFrom })),
    { paysTravelTime, sleepInPence },
  );
  const money = (pence: number) => (pence / 100).toLocaleString("en-GB", { style: "currency", currency: "GBP" });
  const hrs = (h: number) => `${+h.toFixed(2)} hour${h === 1 ? "" : "s"}`;
  const missingNames = workers.filter((w) => cost.missingRate.includes(w.id)).map((w) => w.fullName);

  const splitPart = (s: (typeof shifts)[number]) => {
    const parts = shifts.filter((p) => p.splitGroupId === s.splitGroupId);
    return parts.length > 1 ? { part: parts.findIndex((p) => p.id === s.id) + 1, of: parts.length } : null;
  };
  const hoursThisWeek = new Map([...cost.byWorker].map(([id, w]) => [id, w.hours]));
  const boardShifts: BoardShift[] = shifts.map((s) => {
    const open = !s.workerId ? checks.open.find((o) => o.id === s.id) : undefined;
    return {
      id: s.id,
      workerId: s.workerId,
      date: londonParts(s.startsAt.getTime()).date,
      start: timeFmt.format(s.startsAt),
      end: timeFmt.format(s.endsAt),
      breakMinutes: breaks.filter((b) => b.shiftId === s.id).reduce((m, b) => m + Math.round((b.endsAt.getTime() - b.startsAt.getTime()) / MINUTE), 0),
      roleId: s.roleId,
      clientId: s.clientId,
      clientName: s.clientId ? (clientName.get(s.clientId) ?? "Visit") : null,
      travelMinutes: s.travelMinutes,
      note: s.note,
      loneWorking: s.loneWorking,
      checkInMinutes: s.checkInMinutes,
      kind: s.kind,
      requires: requirements.filter((r) => r.shiftId === s.id).map((r) => r.qualificationId),
      status: s.status === "published" ? "published" : "draft",
      coverRequested: !!s.coverRequestedAt,
      requested: claimed.has(s.id),
      split: s.splitGroupId ? splitPart(s) : null,
      problems: findings.filter((f) => f.shiftIds.includes(s.id)).map((f) => ({ severity: f.severity, message: f.message })),
      candidates: open
        ? candidatesFor(checks.context, open, hoursThisWeek).map((c) => ({
            workerId: c.workerId,
            name: workerName.get(c.workerId) ?? "Someone",
            hours: hoursThisWeek.get(c.workerId) ?? 0,
            blocks: c.blocks.map((f) => f.message),
            warnings: c.warnings.map((f) => f.message),
          }))
        : undefined,
    };
  });

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 lg:px-8">
      <div className="mt-2 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Rota for the week of {dayFmt.format(new Date(`${week}T12:00:00Z`))}</h1>
        <nav className="flex gap-4" aria-label="Change week">
          <Link href={`/rota?week=${addDays(week, -7)}`} className="underline">Previous week</Link>
          <Link href={`/rota?week=${addDays(week, 7)}`} className="underline">Next week</Link>
        </nav>
      </div>

      {shifts.length > 0 && (
        <section aria-label="Planned hours and wages" className="mt-4 rounded-lg border border-zinc-300 p-4 dark:border-zinc-700">
          <p className="text-lg">
            <span className="font-semibold">{hrs(cost.hours)}</span> planned, <span className="font-semibold">{money(cost.pence)}</span> in wages
            {cost.openHours > 0 && <>, plus {hrs(cost.openHours)} of open shifts not yet costed</>}.
          </p>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Hourly pay for scheduled time after unpaid breaks{paysTravelTime ? ", including paid travel between visits" : ""}
            {shifts.some((s) => s.kind === "sleep_in") && (sleepInPence === null ? ". Sleep-ins are not costed because no sleep-in payment is set" : ". Sleep-ins are costed at the sleep-in payment")}. Holiday pay, employer National Insurance and
            pension are not included.
          </p>
          {missingNames.length > 0 && <p className="mt-2" role="alert">No pay rate for {missingNames.join(", ")} on some of these days, so their wages are missing from the total.</p>}
        </section>
      )}
      {workers.length > 0 && (
        <div className="mt-4 flex flex-wrap items-start gap-4">
          {lastWeek > 0 && <CopyWeekForm weekStart={week} count={lastWeek} />}
          {/* Stays on the page once the shifts are filled, so its message can be read. */}
          {shifts.length > 0 && <FillOpenShiftsForm weekStart={week} open={openDrafts} />}
          <Link href={`/rota/patterns?week=${week}`} className="rounded-lg border border-zinc-400 px-4 py-2">Rota patterns</Link>
        </div>
      )}

      {workers.length === 0 ? (
        <p className="mt-6">
          Add your staff first on the <Link href="/staff" className="underline">Staff page</Link>.
        </p>
      ) : (
        <RotaBoard
          days={days.map((d, i) => ({ date: d, label: dayFmt.format(new Date(`${d}T12:00:00Z`)), long: longFmt.format(new Date(`${d}T12:00:00Z`)), weekday: i + 1 }))}
          workers={workers.map((w) => ({
            id: w.id,
            name: w.fullName,
            summary: cost.byWorker.has(w.id) ? `${+cost.byWorker.get(w.id)!.hours.toFixed(2)}h · ${money(cost.byWorker.get(w.id)!.pence)}` : null,
            roleIds: workerRoles.filter((r) => r.workerId === w.id).map((r) => r.roleId),
          }))}
          shifts={boardShifts}
          leave={leave.flatMap((l) =>
            days.filter((d) => l.startsOn <= d && l.endsOn >= d).map((d) => ({ workerId: l.workerId, date: d, label: LEAVE_LABEL[l.kind], requested: l.status === "requested" })),
          )}
          unavailable={unavailable.map((u) => ({ workerId: u.workerId, weekday: u.weekday, from: u.startsAt, to: u.endsAt }))}
          roles={roles.map((r) => ({ id: r.id, name: r.name, colour: r.colour }))}
          training={training}
          clients={sector === "care" ? clients.filter((c) => c.active) : undefined}
          usualTimes={usualTimes(recent)}
          shortNoticeHours={shortNoticeHours}
        />
      )}

      <section className="mt-8" aria-labelledby="check-heading">
        <h2 id="check-heading" className="text-lg font-semibold">Check and publish</h2>
        <p className="mt-1">
          {drafts === 0 ? "No draft shifts this week." : `${drafts} draft shift${drafts === 1 ? "" : "s"} waiting to be published.`} Before you publish, every shift is checked against the law and your records. That includes working time, under-18 rules, minimum wage, right to work, DBS, training, booked leave and your{" "}
          <Link href="/staffing" className="underline">safe staffing levels</Link>.
        </p>
        <PublishForm weekStart={week} />
        {shifts.length > 0 && (
          <div className="mt-4">
            {decision && (
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Last checked with the publish button {decision.checkedAt.toLocaleString("en-GB", { timeZone: "Europe/London" })}
                {decision.requestId && ` · reference ${decision.requestId}`}
              </p>
            )}
            {findings.length === 0 && gaps.length === 0 ? (
              <p className="mt-2">No problems found in this week&rsquo;s shifts right now.</p>
            ) : (
              <ul className="mt-2 space-y-2">
                {gaps.map((g) => (
                  <li key={`${g.levelId}-${g.from}`} className={`rounded-lg border-l-4 p-3 ${g.strict ? "border-red-600 bg-red-50 dark:bg-red-950" : "border-amber-500 bg-warn-soft"}`}>
                    <p>
                      <span className="font-semibold">{g.strict ? "Must fix: " : "Check: "}</span>
                      {g.message} Add or move a shift to cover it.
                    </p>
                    <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                      Safe staffing · <Link href="/staffing" className="underline">your staffing levels</Link>
                    </p>
                  </li>
                ))}
                {findings.map((f, i) => (
                  <li key={i} className={`rounded-lg border-l-4 p-3 ${f.severity === "block" ? "border-red-600 bg-red-50 dark:bg-red-950" : "border-amber-500 bg-warn-soft"}`}>
                    <p>
                      <span className="font-semibold">{f.severity === "block" ? "Must fix: " : "Check: "}</span>
                      {f.message}
                    </p>
                    <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                      {f.shiftIds.length > 0 && workerName.has(f.workerId) && `${workerName.get(f.workerId)} · `}
                      {f.legalRef}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>

      <section className="mt-8" aria-labelledby="claims-heading">
        <h2 id="claims-heading" className="text-lg font-semibold">Requests to pick up shifts</h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Each request has already passed the same legal checks as the rota. Approving checks again in case anything changed.
        </p>
        <ClaimList
          claims={claimsShown.map(({ claim, name, shift }) => ({
            id: claim.id,
            name,
            when: `${dayFmt.format(new Date(`${londonParts(shift.startsAt.getTime()).date}T12:00:00Z`))}, ${timeFmt.format(shift.startsAt)}–${timeFmt.format(shift.endsAt)}`,
            kind: shift.workerId ? "cover" : "open",
            warnings: (claim.warnings as Finding[]).map((f) => f.message),
          }))}
        />
      </section>

      <section className="mt-8" aria-labelledby="swaps-heading">
        <h2 id="swaps-heading" className="text-lg font-semibold">Swaps agreed between staff</h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Both people have said yes, and the swap passed the legal checks for both of them. Approving checks again, then swaps the two shifts.
        </p>
        <SwapList
          swaps={swaps.map(({ swap, fromShift, toShift, fromName, toName }) => ({
            id: swap.id,
            summary: `${fromName} takes ${shiftWhen(toShift)}, and ${toName} takes ${shiftWhen(fromShift)}`,
            note: swap.note,
            warnings: (swap.warnings as Finding[]).map((f) => f.message),
          }))}
        />
      </section>
    </main>
  );
}
