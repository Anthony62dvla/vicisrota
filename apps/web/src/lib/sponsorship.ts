import { addDays, londonParts, sponsorDuties, weekStart, type SponsorDay, type SponsorDuty, type SponsorWeek } from "@vicisrota/compliance";
import { schema, type Transaction } from "@vicisrota/db";
import { and, eq, gte, inArray, isNotNull, lt, ne } from "drizzle-orm";
import { loadPayroll, periodBounds } from "./payroll";

/** How far back absence and pay are checked. */
const LOOKBACK_DAYS = 120;
const PAY_WEEKS = 8;

type Report = typeof schema.sponsorReport.$inferSelect;

/**
 * The business's sponsored workers and the sponsor duties due for them today, with any already reported.
 * Runs inside withOrganisation.
 */
export const loadSponsorship = async (tx: Transaction, organisationId: string, today: string) => {
  const workers = await tx.select().from(schema.worker).where(isNotNull(schema.worker.sponsorship));
  if (!workers.length) return { workers, duties: [] as (SponsorDuty & { reported: Report | null })[] };
  const ids = workers.map((w) => w.id);
  const from = addDays(today, -LOOKBACK_DAYS);
  const { start } = periodBounds(from, from);
  const { start: end } = periodBounds(today, today);

  const [checks, shifts, leave, reports] = await Promise.all([
    tx.select().from(schema.workerCheck).where(and(inArray(schema.workerCheck.workerId, ids), eq(schema.workerCheck.kind, "right_to_work"))),
    tx
      .select({ id: schema.shift.id, workerId: schema.shift.workerId, startsAt: schema.shift.startsAt })
      .from(schema.shift)
      .where(and(inArray(schema.shift.workerId, ids), eq(schema.shift.status, "published"), gte(schema.shift.startsAt, start), lt(schema.shift.startsAt, end))),
    tx
      .select()
      .from(schema.leaveRequest)
      .where(and(inArray(schema.leaveRequest.workerId, ids), eq(schema.leaveRequest.status, "approved"), gte(schema.leaveRequest.endsOn, from))),
    tx.select().from(schema.sponsorReport).where(inArray(schema.sponsorReport.workerId, ids)),
  ]);
  const shiftIds = shifts.map((s) => s.id);
  const [entries, clocks] = shiftIds.length
    ? await Promise.all([
        tx.select({ shiftId: schema.timeEntry.shiftId }).from(schema.timeEntry).where(inArray(schema.timeEntry.shiftId, shiftIds)),
        tx.select({ shiftId: schema.clockEvent.shiftId }).from(schema.clockEvent).where(and(inArray(schema.clockEvent.shiftId, shiftIds), ne(schema.clockEvent.kind, "out"))),
      ])
    : [[], []];
  const confirmed = new Set(entries.map((e) => e.shiftId));
  const clocked = new Set(clocks.map((c) => c.shiftId));
  const onLeave = (workerId: string, date: string) => leave.some((l) => l.workerId === workerId && l.startsOn <= date && l.endsOn >= date);

  // One entry per rostered day: attended if any shift that day was clocked or confirmed.
  const byDay = new Map<string, SponsorDay>();
  for (const s of shifts) {
    const date = londonParts(s.startsAt.getTime()).date;
    const key = `${s.workerId}|${date}`;
    const day = byDay.get(key) ?? { workerId: s.workerId!, date, attended: false, onLeave: onLeave(s.workerId!, date) };
    day.attended ||= confirmed.has(s.id) || clocked.has(s.id);
    byDay.set(key, day);
  }

  // Pay in each of the last complete weeks, from confirmed hours.
  const weeks: SponsorWeek[] = [];
  const thisWeek = weekStart(today);
  for (let i = PAY_WEEKS; i >= 1; i--) {
    const monday = addDays(thisWeek, -7 * i);
    const sunday = addDays(monday, 6);
    const { lines } = await loadPayroll(tx, organisationId, monday, sunday);
    for (const w of workers) {
      const days = [...byDay.values()].filter((d) => d.workerId === w.id && d.date >= monday && d.date <= sunday);
      const weekShifts = shifts.filter((s) => s.workerId === w.id && londonParts(s.startsAt.getTime()).date >= monday && londonParts(s.startsAt.getTime()).date <= sunday);
      weeks.push({
        workerId: w.id,
        weekStart: monday,
        pence: lines.find((l) => l.workerId === w.id)?.grossPence ?? 0,
        hadLeave: days.some((d) => d.onLeave) || leave.some((l) => l.workerId === w.id && l.startsOn <= sunday && l.endsOn >= monday),
        unconfirmed: weekShifts.some((s) => !confirmed.has(s.id)),
      });
    }
  }

  const duties = sponsorDuties({
    today,
    workers: workers.map((w) => {
      const latest = checks.filter((c) => c.workerId === w.id).sort((a, b) => (a.checkedOn < b.checkedOn ? 1 : -1))[0];
      return { id: w.id, name: w.fullName, sponsorship: w.sponsorship!, leftOn: w.leftOn, permissionEndsOn: latest ? latest.expiresOn : undefined };
    }),
    days: [...byDay.values()],
    weeks,
  }).map((d) => ({ ...d, reported: reports.find((r) => r.workerId === d.workerId && r.kind === d.kind && r.eventDate === d.eventDate) ?? null }));
  return { workers, duties };
};
