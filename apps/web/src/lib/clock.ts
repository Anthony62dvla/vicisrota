import { clockSummary, nextClockActions, placeCheck, type ClockKind, type ClockSummary } from "@vicisrota/compliance";
import { schema, type Transaction } from "@vicisrota/db";
import { and, asc, eq, gt, inArray, isNotNull, lt } from "drizzle-orm";

/** Staff can clock in up to an hour early, and clock out up to four hours after the rostered end. */
export const CLOCK_IN_EARLY_MS = 60 * 60_000;
export const CLOCK_OUT_LATE_MS = 4 * 3_600_000;

export type ClockedShift = { shift: typeof schema.shift.$inferSelect; events: (typeof schema.clockEvent.$inferSelect)[]; summary: ClockSummary };

/** Clock summaries for the given shifts. */
export const clockSummaries = async (tx: Transaction, shifts: (typeof schema.shift.$inferSelect)[], now: number): Promise<ClockedShift[]> => {
  const ids = shifts.map((s) => s.id);
  const events = ids.length ? await tx.select().from(schema.clockEvent).where(inArray(schema.clockEvent.shiftId, ids)).orderBy(asc(schema.clockEvent.at)) : [];
  return shifts.map((shift) => ({
    shift,
    events: events.filter((e) => e.shiftId === shift.id),
    summary: clockSummary(
      events.filter((e) => e.shiftId === shift.id).map((e) => ({ kind: e.kind, at: e.at.getTime() })),
      { start: shift.startsAt.getTime(), end: shift.endsAt.getTime() },
      now,
    ),
  }));
};

/** The person's published shifts they can clock in or out of right now. */
export const clockableShifts = async (tx: Transaction, workerId: string, now: number) =>
  clockSummaries(
    tx,
    await tx
      .select()
      .from(schema.shift)
      .where(
        and(
          eq(schema.shift.workerId, workerId),
          eq(schema.shift.status, "published"),
          lt(schema.shift.startsAt, new Date(now + CLOCK_IN_EARLY_MS)),
          gt(schema.shift.endsAt, new Date(now - CLOCK_OUT_LATE_MS)),
        ),
      )
      .orderBy(asc(schema.shift.startsAt)),
    now,
  );

const ukTime = (d: Date) => new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(d);
const distanceText = (m: number) => (m < 1000 ? `${m} metres` : `${(m / 1000).toFixed(1)} km`);

export type Position = { latitude: number; longitude: number; accuracyMetres: number };

/**
 * Records a clock-in, break or clock-out, from a phone or an in-store tablet. A phone clock-in is
 * checked against the business's workplaces when it has turned location checks on. Only clocking in
 * can be refused for being away from work: refusing a clock-out would just leave the hours wrong.
 */
export const recordClock = async (
  tx: Transaction,
  input: {
    organisationId: string;
    workerId: string;
    actorUserId: string | null;
    shiftId: string;
    kind: ClockKind;
    requestId: string | null;
    source: "phone" | "kiosk";
    /** Phone: where it was, or null if the person did not share it. */
    position?: Position | null;
    /** Kiosk: the workplace the tablet is at. */
    kioskLocationId?: string;
  },
): Promise<{ error?: string; ok?: string }> => {
  const now = new Date().getTime();
  const current = (await clockableShifts(tx, input.workerId, now)).find((c) => c.shift.id === input.shiftId);
  if (!current) return { error: "You can only clock in from an hour before your shift until four hours after it ends." };
  if (!nextClockActions(current.summary.state).includes(input.kind)) {
    return { error: { in: "You are already clocked in.", break_start: "You are not clocked in.", break_end: "You are not on a break.", out: "You are not clocked in." }[input.kind] };
  }

  let place: { locationId: string | null; place: "at_work" | "away" | "unknown" | null; distanceMetres: number | null } = {
    locationId: input.kioskLocationId ?? null,
    place: input.source === "kiosk" ? "at_work" : null,
    distanceMetres: null,
  };
  if (input.source === "phone") {
    const [org] = await tx.select({ rule: schema.organisation.clockLocationRule }).from(schema.organisation).where(eq(schema.organisation.id, input.organisationId));
    const workplaces = (await tx.select().from(schema.location).where(and(isNotNull(schema.location.latitude), isNotNull(schema.location.longitude)))).map((l) => ({
      id: l.id,
      name: l.name,
      latitude: l.latitude!,
      longitude: l.longitude!,
      radiusMetres: l.radiusMetres,
    }));
    if (org && org.rule !== "off" && workplaces.length) {
      const check = input.position ? placeCheck(input.position, workplaces) : null;
      place = check
        ? { locationId: check.workplaceId, place: check.within ? "at_work" : "away", distanceMetres: check.distanceMetres }
        : { locationId: null, place: "unknown", distanceMetres: null };
      if (org.rule === "require" && input.kind === "in" && place.place !== "at_work") {
        if (place.place === "unknown") return { error: "To clock in from your phone, allow it to share your location, or use the clock-in tablet at work." };
        const name = workplaces.find((w) => w.id === check!.workplaceId)!.name;
        return { error: `You need to be at work to clock in. Your phone shows you about ${distanceText(check!.distanceMetres)} from ${name}.` };
      }
    }
  }

  const [event] = await tx
    .insert(schema.clockEvent)
    .values({ organisationId: input.organisationId, workerId: input.workerId, shiftId: input.shiftId, kind: input.kind, source: input.source, ...place })
    .returning({ at: schema.clockEvent.at });
  await tx.insert(schema.auditEvent).values({
    organisationId: input.organisationId,
    actorUserId: input.actorUserId,
    requestId: input.requestId,
    action: `clock_${input.kind}`,
    entity: "shift",
    entityId: input.shiftId,
    data: { source: input.source, place: place.place, distanceMetres: place.distanceMetres },
  });
  const at = ukTime(event!.at);
  const away = place.place === "away" ? " Your phone showed you away from work, so your manager will see that." : "";
  return {
    ok: { in: `Clocked in at ${at}.`, break_start: `Break started at ${at}.`, break_end: `Break ended at ${at}.`, out: `Clocked out at ${at}. Thank you.` }[input.kind] + away,
  };
};
