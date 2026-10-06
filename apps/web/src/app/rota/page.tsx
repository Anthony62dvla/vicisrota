import { addDays, affordableHours, evaluate, forecastSales, labourPercent, LABOUR_COST_LEGAL_REF, londonParts, onCostsFor, weekCost, weekStart as mondayOf, type Finding } from "@vicisrota/compliance";
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
import { ClaimList, CopyWeekForm, FillOpenShiftsForm, PublishForm, SalesTargetsForm, SwapList } from "./forms";
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

  const { swaps, workers, training, clients, shifts, claims, leave, decision, rates, breaks, paysTravelTime, shortNoticeHours, lastWeek, roles, requirements, unavailable, workerRoles, recent, checks, gaps, sleepInPence, labourTargetPercent, sales } = await withOrganisation(db, organisationId, async (tx) => ({
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
    // This week's figures, plus 6 weeks before for forecasts.
    sales: sector === "care" ? [] : await tx.select().from(schema.salesForecast).where(and(gte(schema.salesForecast.on, addDays(days[0]!, -42)), lte(schema.salesForecast.on, days[6]!))),
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
      .select({
        paysTravelTime: schema.organisation.paysTravelTime,
        shortNoticeHours: schema.organisation.shortNoticeHours,
        sleepInPence: schema.organisation.sleepInPence,
        labourTargetPercent: schema.organisation.labourTargetPercent,
      })
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
  const planned = shifts.map((s) => ({
      id: s.id,
      workerId: s.workerId,
      start: s.startsAt.toISOString(),
      end: s.endsAt.toISOString(),
      travelMinutesBefore: s.travelMinutes,
      sleepIn: s.kind === "sleep_in" ? { awakeMinutes: 0 } : undefined,
      breaks: breaks.filter((b) => b.shiftId === s.id).map((b) => ({ start: b.startsAt.toISOString(), end: b.endsAt.toISOString() })),
  }));
  const payRates = rates.map((r) => ({ workerId: r.workerId, hourlyPence: r.hourlyPence, effectiveFrom: r.effectiveFrom }));
  const cost = weekCost(planned, payRates, { paysTravelTime, sleepInPence });
  const onCosts = onCostsFor(
    workers.filter((w) => cost.byWorker.has(w.id)).map((w) => ({ wagesPence: cost.byWorker.get(w.id)!.pence, dateOfBirth: w.dateOfBirth, apprentice: w.apprenticeRateApplies })),
    week,
  );
  // Wages against expected sales, day by day (not care).
  const salesOn = new Map(sales.filter((d) => d.on >= days[0]!).map((d) => [d.on, d.pence]));
  const history = sales.map((d) => ({ date: d.on, pence: d.pence }));
  const averageRate = cost.hours > 0 ? cost.pence / cost.hours : 0;
  const byDay = days.map((d) => {
    const dayCost = weekCost(planned.filter((p) => londonParts(new Date(p.start).getTime()).date === d), payRates, { paysTravelTime, sleepInPence });
    const salesPence = salesOn.get(d) ?? null;
    return {
      date: d,
      wages: dayCost.pence,
      hours: dayCost.hours,
      salesPence,
      forecast: forecastSales(history, d),
      percent: labourPercent(dayCost.pence, salesPence),
      affordable: salesPence !== null && labourTargetPercent !== null ? affordableHours(salesPence, labourTargetPercent, averageRate) : null,
    };
  });
  const salesTotal = [...salesOn.values()].reduce((t, p) => t + p, 0);
  const canForecast = byDay.some((d) => d.forecast !== null);
  const weekPercent = labourPercent(byDay.filter((d) => d.salesPence !== null).reduce((t, d) => t + d.wages, 0), salesTotal);
  const over = (p: number | null) => p !== null && labourTargetPercent !== null && p > labourTargetPercent;
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
            pension are shown below as an estimate.
          </p>
          {cost.pence > 0 && (
            <p className="mt-2">
              With an estimated <span className="font-semibold">{money(onCosts.totalPence)}</span> for holiday built up ({money(onCosts.holidayPence)}), employer National
              Insurance ({money(onCosts.nationalInsurancePence)}) and workplace pension ({money(onCosts.pensionPence)}), this week costs about{" "}
              <span className="font-semibold">{money(cost.pence + onCosts.totalPence)}</span>.
            </p>
          )}
          {cost.pence > 0 && (
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              The estimate uses 2026/27 rates and does not take off the Employment Allowance, so your real cost may be lower. Based on: {LABOUR_COST_LEGAL_REF}.
            </p>
          )}
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

      {sector !== "care" && workers.length > 0 && (
        <section className="mt-8" aria-labelledby="sales-heading">
          <h2 id="sales-heading" className="text-lg font-semibold">Wages against sales</h2>
          <p className="mt-1">
            Put in the sales you expect each day to see wages as a share of them.
            {labourTargetPercent !== null ? ` Days above your target of ${labourTargetPercent}% are marked.` : " Add a target to have busy-cost days marked."}
          </p>
          {salesTotal > 0 && (
            <div className="mt-3 overflow-x-auto">
              <table className="min-w-full text-left">
                <caption className="sr-only">Wages and expected sales by day</caption>
                <thead>
                  <tr className="border-b border-zinc-300 dark:border-zinc-700">
                    <th scope="col" className="py-2 pr-4">Day</th>
                    <th scope="col" className="py-2 pr-4">Wages</th>
                    <th scope="col" className="py-2 pr-4">Expected sales</th>
                    <th scope="col" className="py-2 pr-4">Wages as a share</th>
                    {labourTargetPercent !== null && <th scope="col" className="py-2 pr-4">Hours planned / affordable</th>}
                  </tr>
                </thead>
                <tbody>
                  {byDay.map((d) => (
                    <tr key={d.date} className="border-b border-zinc-200 dark:border-zinc-800">
                      <th scope="row" className="py-2 pr-4 font-normal">{dayFmt.format(new Date(`${d.date}T12:00:00Z`))}</th>
                      <td className="py-2 pr-4">{money(d.wages)}</td>
                      <td className="py-2 pr-4">{d.salesPence === null ? "Not set" : money(d.salesPence)}</td>
                      <td className={`py-2 pr-4 ${over(d.percent) ? "font-semibold text-amber-800 dark:text-amber-300" : ""}`}>
                        {d.percent === null ? "" : `${d.percent}%`}
                        {over(d.percent) && " (above target)"}
                      </td>
                      {labourTargetPercent !== null && (
                        <td className="py-2 pr-4">{d.affordable === null ? "" : `${+d.hours.toFixed(2)} / ${d.affordable}`}</td>
                      )}
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <th scope="row" className="py-2 pr-4">Week</th>
                    <td className="py-2 pr-4 font-semibold">{money(cost.pence)}</td>
                    <td className="py-2 pr-4 font-semibold">{money(salesTotal)}</td>
                    <td className={`py-2 pr-4 font-semibold ${over(weekPercent) ? "text-amber-800 dark:text-amber-300" : ""}`}>
                      {weekPercent === null ? "" : `${weekPercent}%`}
                      {over(weekPercent) && " (above target)"}
                    </td>
                    {labourTargetPercent !== null && <td />}
                  </tr>
                </tfoot>
              </table>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                Shares compare wages with sales on days that have a sales figure. Open shifts are not costed.
                {labourTargetPercent !== null && " Affordable hours are what your target allows at this week's average hourly pay."}
              </p>
            </div>
          )}
          <SalesTargetsForm
            weekStart={week}
            targetPercent={labourTargetPercent}
            canForecast={canForecast}
            days={byDay.map((d) => ({
              date: d.date,
              label: dayFmt.format(new Date(`${d.date}T12:00:00Z`)),
              pounds: d.salesPence !== null ? (d.salesPence / 100).toFixed(2) : "",
              forecast: d.forecast !== null ? (d.forecast / 100).toFixed(0) : "",
            }))}
          />
        </section>
      )}

      <section className="mt-8" aria-labelledby="check-heading">
        <h2 id="check-heading" className="text-lg font-semibold">Check and publish</h2>
        <p className="mt-1">
          {drafts === 0 ? "No draft shifts this week." : `${drafts} draft shift${drafts === 1 ? "" : "s"} waiting to be published.`} Before you publish, every shift is checked against the law and your records. That includes working time, under-18 rules, minimum wage, right to work, DBS, training, booked leave and your{" "}
          <Link href="/staffing" className="underline">safe staffing levels</Link>.
        </p>
        {cost.pence > 0 && (
          <p className="mt-2">
            This week&apos;s wages: <span className="font-semibold">{money(cost.pence)}</span>, or about {money(cost.pence + onCosts.totalPence)} with holiday, National Insurance and
            pension{weekPercent !== null ? `, ${weekPercent}% of expected sales` : ""}.
          </p>
        )}
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
