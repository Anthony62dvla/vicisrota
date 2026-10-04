import { addDays, capturePattern, expandPattern, londonParts, type PatternSlot } from "@vicisrota/compliance";
import { schema, type Transaction } from "@vicisrota/db";
import { and, eq, gte, inArray, lt, lte, ne } from "drizzle-orm";
import { weekBounds } from "./rota";

type Details = {
  workerId: string | null;
  roleId: string | null;
  clientId: string | null;
  locationId: string | null;
  note: string | null;
  travelMinutes: number;
  loneWorking: boolean;
  checkInMinutes: number;
  requires: string[];
};

/**
 * Saves the shifts in `weeks` weeks from the Monday `firstWeek` as a pattern. Drafts count as well as
 * published shifts, so a manager can build the pattern without publishing it. Returns how many shifts it holds.
 */
export const savePattern = async (
  tx: Transaction,
  input: { organisationId: string; userId: string; name: string; firstWeek: string; weeks: number },
): Promise<{ patternId: string; shifts: number }> => {
  const from = weekBounds(input.firstWeek).from;
  const to = weekBounds(addDays(input.firstWeek, 7 * (input.weeks - 1))).to;
  const shifts = await tx
    .select()
    .from(schema.shift)
    .where(and(gte(schema.shift.startsAt, from), lt(schema.shift.startsAt, to), ne(schema.shift.status, "cancelled")));
  const ids = shifts.map((s) => s.id);
  const [breaks, requirements] = ids.length
    ? await Promise.all([
        tx.select().from(schema.shiftBreak).where(inArray(schema.shiftBreak.shiftId, ids)),
        tx.select().from(schema.shiftRequirement).where(inArray(schema.shiftRequirement.shiftId, ids)),
      ])
    : [[], []];
  const slots = capturePattern<Details>(
    shifts.map((s) => ({
      start: s.startsAt.getTime(),
      end: s.endsAt.getTime(),
      breaks: breaks.filter((b) => b.shiftId === s.id).map((b) => ({ start: b.startsAt.getTime(), end: b.endsAt.getTime() })),
      details: {
        workerId: s.workerId,
        roleId: s.roleId,
        clientId: s.clientId,
        locationId: s.locationId,
        note: s.note,
        travelMinutes: s.travelMinutes,
        loneWorking: s.loneWorking,
        checkInMinutes: s.checkInMinutes,
        requires: requirements.filter((r) => r.shiftId === s.id).map((r) => r.qualificationId),
      },
    })),
    input.firstWeek,
    input.weeks,
  );
  const [pattern] = await tx
    .insert(schema.rotaPattern)
    .values({ organisationId: input.organisationId, name: input.name, weeks: input.weeks, createdByUserId: input.userId })
    .returning({ id: schema.rotaPattern.id });
  if (slots.length) {
    await tx.insert(schema.rotaPatternShift).values(
      slots.map((s) => ({
        organisationId: input.organisationId,
        patternId: pattern!.id,
        weekIndex: s.weekIndex,
        weekday: s.weekday,
        startTime: s.startTime,
        endTime: s.endTime,
        endsNextDay: s.endsNextDay,
        breaks: s.breaks,
        ...s.details,
      })),
    );
  }
  return { patternId: pattern!.id, shifts: slots.length };
};

export const slotsOf = (rows: (typeof schema.rotaPatternShift.$inferSelect)[]): PatternSlot<Details>[] =>
  rows.map((r) => ({
    weekIndex: r.weekIndex,
    weekday: r.weekday,
    startTime: r.startTime,
    endTime: r.endTime,
    endsNextDay: r.endsNextDay,
    breaks: r.breaks,
    details: {
      workerId: r.workerId,
      roleId: r.roleId,
      clientId: r.clientId,
      locationId: r.locationId,
      note: r.note,
      travelMinutes: r.travelMinutes,
      loneWorking: r.loneWorking,
      checkInMinutes: r.checkInMinutes,
      requires: r.requires,
    },
  }));

/**
 * Fills `weeks` weeks from the Monday `fromWeek` with draft shifts from a pattern. A shift already on
 * the rota for the same person at the same time is skipped, so filling twice adds nothing. Someone on
 * approved leave or sickness that day gets no shift: it is added as an open shift for cover instead.
 */
export const fillFromPattern = async (
  tx: Transaction,
  input: { organisationId: string; patternId: string; fromWeek: string; weeks: number; startAtWeek: number },
): Promise<{ added: number; skipped: number; madeOpen: number } | null> => {
  const [pattern] = await tx.select().from(schema.rotaPattern).where(eq(schema.rotaPattern.id, input.patternId));
  if (!pattern) return null;
  const rows = await tx.select().from(schema.rotaPatternShift).where(eq(schema.rotaPatternShift.patternId, pattern.id));
  const planned = expandPattern(slotsOf(rows), pattern.weeks, input.fromWeek, input.weeks, input.startAtWeek % pattern.weeks);
  if (!planned.length) return { added: 0, skipped: 0, madeOpen: 0 };

  const from = weekBounds(input.fromWeek).from;
  const to = weekBounds(addDays(input.fromWeek, 7 * (input.weeks - 1))).to;
  const lastDay = addDays(input.fromWeek, 7 * input.weeks - 1);
  const [existing, leave, qualifications] = await Promise.all([
    tx
      .select({ workerId: schema.shift.workerId, startsAt: schema.shift.startsAt, endsAt: schema.shift.endsAt })
      .from(schema.shift)
      .where(and(gte(schema.shift.startsAt, from), lt(schema.shift.startsAt, to), ne(schema.shift.status, "cancelled"))),
    tx
      .select({ workerId: schema.leaveRequest.workerId, startsOn: schema.leaveRequest.startsOn, endsOn: schema.leaveRequest.endsOn })
      .from(schema.leaveRequest)
      .where(and(eq(schema.leaveRequest.status, "approved"), lte(schema.leaveRequest.startsOn, lastDay), gte(schema.leaveRequest.endsOn, input.fromWeek))),
    tx.select({ id: schema.qualification.id }).from(schema.qualification),
  ]);
  const taken = new Set(existing.map((e) => `${e.workerId}|${e.startsAt.getTime()}|${e.endsAt.getTime()}`));
  const known = new Set(qualifications.map((q) => q.id));

  let added = 0;
  let skipped = 0;
  let madeOpen = 0;
  for (const p of planned) {
    const day = londonParts(p.start).date;
    const away = p.details.workerId && leave.some((l) => l.workerId === p.details.workerId && l.startsOn <= day && l.endsOn >= day);
    const workerId = away ? null : p.details.workerId;
    // Checked against the person in the pattern, so a re-fill after leave was booked does not add a second open shift.
    if (taken.has(`${p.details.workerId}|${p.start}|${p.end}`) || taken.has(`${workerId}|${p.start}|${p.end}`)) {
      skipped++;
      continue;
    }
    const { requires, ...details } = p.details;
    const [row] = await tx
      .insert(schema.shift)
      .values({ organisationId: input.organisationId, ...details, workerId, startsAt: new Date(p.start), endsAt: new Date(p.end) })
      .returning({ id: schema.shift.id });
    if (p.breaks.length) {
      await tx
        .insert(schema.shiftBreak)
        .values(p.breaks.map((b) => ({ organisationId: input.organisationId, shiftId: row!.id, startsAt: new Date(b.start), endsAt: new Date(b.end) })));
    }
    const needs = requires.filter((q) => known.has(q));
    if (needs.length) await tx.insert(schema.shiftRequirement).values(needs.map((qualificationId) => ({ organisationId: input.organisationId, shiftId: row!.id, qualificationId })));
    added++;
    if (away) madeOpen++;
  }
  return { added, skipped, madeOpen };
};
