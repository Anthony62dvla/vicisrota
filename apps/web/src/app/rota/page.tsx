import { addDays, londonParts, weekCost, weekStart as mondayOf, type Finding } from "@vicisrota/compliance";
import { schema, withOrganisation } from "@vicisrota/db";
import { and, asc, desc, eq, gte, inArray, lt, lte, ne } from "drizzle-orm";
import Link from "next/link";
import { requireManager } from "@/lib/business";
import { db } from "@/lib/db";
import { LEAVE_LABEL } from "@/lib/leave";
import { todayInUk, weekBounds } from "@/lib/rota";
import { cancelShift } from "./actions";
import { AddShiftForm, ClaimList, CopyWeekForm, PublishForm } from "./forms";
import { RoleBadge } from "../role-badge";

const timeFmt = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit" });
const dayFmt = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" });
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export default async function RotaPage({ searchParams }: PageProps<"/rota">) {
  const { organisationId, sector  } = await requireManager();
  const requested = (await searchParams).week;
  const today = todayInUk();
  const week = mondayOf(typeof requested === "string" && DATE.test(requested) ? requested : today);
  const days = Array.from({ length: 7 }, (_, i) => addDays(week, i));
  const { from, to } = weekBounds(week);

  const previous = weekBounds(addDays(week, -7));

  const { workers, training, clients, shifts, claims, leave, decision, rates, breaks, paysTravelTime, lastWeek, roles } = await withOrganisation(db, organisationId, async (tx) => ({
    workers: await tx.select().from(schema.worker).orderBy(asc(schema.worker.fullName)),
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
    breaks: await tx
      .select({ shiftId: schema.shiftBreak.shiftId, startsAt: schema.shiftBreak.startsAt, endsAt: schema.shiftBreak.endsAt })
      .from(schema.shiftBreak)
      .innerJoin(schema.shift, eq(schema.shiftBreak.shiftId, schema.shift.id))
      .where(and(gte(schema.shift.startsAt, from), lt(schema.shift.startsAt, to))),
    paysTravelTime: (await tx.select({ pays: schema.organisation.paysTravelTime }).from(schema.organisation).where(eq(schema.organisation.id, organisationId)))[0]?.pays ?? false,
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
  const findings = (decision?.findings ?? []) as Finding[];
  const flagged = new Set(findings.flatMap((f) => f.shiftIds));
  const clientName = new Map(clients.map((c) => [c.id, c.name]));
  const roleById = new Map(roles.map((r) => [r.id, r]));
  // Requests for this week's shifts.
  const claimsShown = claims.flatMap((c) => {
    const shift = shifts.find((s) => s.id === c.claim.shiftId);
    return shift ? [{ ...c, shift }] : [];
  });
  const drafts = shifts.filter((s) => s.status === "draft").length;
  const cost = weekCost(
    shifts.map((s) => ({
      id: s.id,
      workerId: s.workerId,
      start: s.startsAt.toISOString(),
      end: s.endsAt.toISOString(),
      travelMinutesBefore: s.travelMinutes,
      breaks: breaks.filter((b) => b.shiftId === s.id).map((b) => ({ start: b.startsAt.toISOString(), end: b.endsAt.toISOString() })),
    })),
    rates.map((r) => ({ workerId: r.workerId, hourlyPence: r.hourlyPence, effectiveFrom: r.effectiveFrom })),
    { paysTravelTime },
  );
  const money = (pence: number) => (pence / 100).toLocaleString("en-GB", { style: "currency", currency: "GBP" });
  const hrs = (h: number) => `${+h.toFixed(2)} hour${h === 1 ? "" : "s"}`;
  const missingNames = workers.filter((w) => cost.missingRate.includes(w.id)).map((w) => w.fullName);

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
            Hourly pay for scheduled time after unpaid breaks{paysTravelTime ? ", including paid travel between visits" : ""}. Holiday pay, employer National Insurance and
            pension are not included.
          </p>
          {missingNames.length > 0 && <p className="mt-2" role="alert">No pay rate for {missingNames.join(", ")} on some of these days, so their wages are missing from the total.</p>}
        </section>
      )}
      {workers.length > 0 && (
        <div className="mt-4 flex flex-wrap items-start gap-4">
          {lastWeek > 0 && <CopyWeekForm weekStart={week} count={lastWeek} />}
          <Link href={`/rota/patterns?week=${week}`} className="rounded-lg border border-zinc-400 px-4 py-2">Rota patterns</Link>
        </div>
      )}

      {workers.length === 0 ? (
        <p className="mt-6">
          Add your staff first on the <Link href="/staff" className="underline">Staff page</Link>.
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[720px] table-fixed border-collapse text-left text-sm">
            <thead>
              <tr>
                <th className="w-36 border-b border-zinc-300 py-2 dark:border-zinc-700">Staff</th>
                {days.map((d) => (
                  <th key={d} className="border-b border-zinc-300 py-2 dark:border-zinc-700">{dayFmt.format(new Date(`${d}T12:00:00Z`))}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {workers.map((w) => (
                <tr key={w.id} className="align-top">
                  <th scope="row" className="border-b border-zinc-200 py-2 font-medium dark:border-zinc-800">
                    {w.fullName}
                    {cost.byWorker.has(w.id) && (
                      <span className="block text-xs font-normal text-zinc-600 dark:text-zinc-400">
                        {+cost.byWorker.get(w.id)!.hours.toFixed(2)}h · {money(cost.byWorker.get(w.id)!.pence)}
                      </span>
                    )}
                  </th>
                  {days.map((d) => (
                    <td key={d} className="border-b border-zinc-200 py-2 pr-2 dark:border-zinc-800">
                      {leave
                        .filter((l) => l.workerId === w.id && l.startsOn <= d && l.endsOn >= d)
                        .map((l) => (
                          <p
                            key={l.id}
                            className={`mb-1 rounded-md p-1 text-xs ${l.status === "approved" ? "bg-sky-100 dark:bg-sky-950" : "border border-dashed border-sky-500"}`}
                          >
                            {LEAVE_LABEL[l.kind]}
                            {l.status === "requested" && " (requested)"}
                          </p>
                        ))}
                      {shifts
                        .filter((s) => s.workerId === w.id && londonParts(s.startsAt.getTime()).date === d)
                        .map((s) => (
                          <div
                            key={s.id}
                            className={`mb-1 rounded-md border p-1 ${flagged.has(s.id) ? "border-red-500" : "border-zinc-300 dark:border-zinc-700"}`}
                          >
                            <p>{timeFmt.format(s.startsAt)}–{timeFmt.format(s.endsAt)}</p>
                            {s.roleId && roleById.has(s.roleId) && <RoleBadge name={roleById.get(s.roleId)!.name} colour={roleById.get(s.roleId)!.colour} />}
                            {s.clientId && <p className="text-xs font-medium">{clientName.get(s.clientId) ?? "Visit"}</p>}
                            {s.note && <p className="line-clamp-2 text-xs" title={s.note}>{s.note}</p>}
                            {s.travelMinutes > 0 && <p className="text-xs text-zinc-600 dark:text-zinc-400">{s.travelMinutes} min travel before</p>}
                            <p className="text-xs text-zinc-600 dark:text-zinc-400">
                              {s.status === "published" ? "Published" : "Draft"}
                              {flagged.has(s.id) && " · needs attention"}
                              {s.coverRequestedAt && " · cover requested"}
                              {s.loneWorking && " · working alone"}
                            </p>
                            <form action={cancelShift}>
                              <input type="hidden" name="shiftId" value={s.id} />
                              <button type="submit" className="text-xs underline">Cancel shift</button>
                            </form>
                          </div>
                        ))}
                    </td>
                  ))}
                </tr>
              ))}
              {shifts.some((s) => !s.workerId) && (
                <tr className="align-top">
                  <th scope="row" className="border-b border-zinc-200 py-2 font-medium dark:border-zinc-800">Open shifts</th>
                  {days.map((d) => (
                    <td key={d} className="border-b border-zinc-200 py-2 pr-2 dark:border-zinc-800">
                      {shifts
                        .filter((s) => !s.workerId && londonParts(s.startsAt.getTime()).date === d)
                        .map((s) => (
                          <div key={s.id} className="mb-1 rounded-md border border-dashed border-zinc-500 p-1">
                            <p>{timeFmt.format(s.startsAt)}–{timeFmt.format(s.endsAt)}</p>
                            {s.roleId && roleById.has(s.roleId) && <RoleBadge name={roleById.get(s.roleId)!.name} colour={roleById.get(s.roleId)!.colour} />}
                            <p className="text-xs text-zinc-600 dark:text-zinc-400">
                              {s.status === "published" ? "Open to staff" : "Draft"}
                              {claims.some((c) => c.claim.shiftId === s.id) && " · requested"}
                            </p>
                            <form action={cancelShift}>
                              <input type="hidden" name="shiftId" value={s.id} />
                              <button type="submit" className="text-xs underline">Cancel shift</button>
                            </form>
                          </div>
                        ))}
                    </td>
                  ))}
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

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

      <section className="mt-8" aria-labelledby="check-heading">
        <h2 id="check-heading" className="text-lg font-semibold">Check and publish</h2>
        <p className="mt-1">
          {drafts === 0 ? "No draft shifts this week." : `${drafts} draft shift${drafts === 1 ? "" : "s"} waiting to be published.`} Every
          shift is checked against UK working time, under-18 and minimum wage rules, right to work, DBS, required training and booked leave before it is published.
        </p>
        <PublishForm weekStart={week} />
        {decision && (
          <div className="mt-4">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Last checked {decision.checkedAt.toLocaleString("en-GB", { timeZone: "Europe/London" })}
              {decision.requestId && ` · reference ${decision.requestId}`}
            </p>
            {findings.length === 0 ? (
              <p className="mt-2">No problems found.</p>
            ) : (
              <ul className="mt-2 space-y-2">
                {findings.map((f, i) => (
                  <li key={i} className={`rounded-lg border p-3 ${f.severity === "block" ? "border-red-500" : "border-amber-500"}`}>
                    <p>
                      <span className="font-semibold">{f.severity === "block" ? "Must fix: " : "Check: "}</span>
                      {f.message}
                    </p>
                    <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{f.legalRef}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>

      {workers.length > 0 && <AddShiftForm workers={workers.map((w) => ({ id: w.id, name: w.fullName }))} days={days} training={training} roles={roles.map((r) => ({ id: r.id, name: r.name }))} clients={sector === "care" ? clients.filter((c) => c.active) : undefined} />}
    </main>
  );
}
