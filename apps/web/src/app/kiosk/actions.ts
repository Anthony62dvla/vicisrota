"use server";

import { schema, withOrganisation } from "@vicisrota/db";
import { and, eq } from "drizzle-orm";
import { recordClock } from "@/lib/clock";
import { db } from "@/lib/db";
import { currentKiosk } from "@/lib/kiosk";
import { log } from "@/lib/log";
import { PIN_LOCK_MINUTES, PIN_MAX_FAILURES, verifyPin } from "@/lib/pin";
import { requestId } from "@/lib/request";

export type KioskState = { error?: string; ok?: string; at?: number };

const KINDS = ["in", "break_start", "break_end", "out"] as const;

/** Clock in or out on the in-store tablet. The person picks their name and the action, then enters their PIN. */
export async function kioskClock(_: KioskState, form: FormData): Promise<KioskState> {
  const kiosk = await currentKiosk();
  if (!kiosk) return { error: "This tablet is no longer set up for clocking in. Ask a manager." };
  const { organisationId, locationId, id: deviceId } = kiosk.device;
  const shiftId = String(form.get("shiftId") ?? "");
  const kind = String(form.get("kind") ?? "") as (typeof KINDS)[number];
  const pin = String(form.get("pin") ?? "");
  if (!KINDS.includes(kind)) return { error: "Something went wrong. Please try again." };
  const reference = await requestId();

  const result = await withOrganisation(db, organisationId, async (tx): Promise<KioskState> => {
    const [row] = await tx
      .select({ worker: schema.worker, shiftLocation: schema.shift.locationId })
      .from(schema.shift)
      .innerJoin(schema.worker, eq(schema.shift.workerId, schema.worker.id))
      .where(and(eq(schema.shift.id, shiftId), eq(schema.shift.organisationId, organisationId)));
    // Shifts for another workplace are clocked there, not here.
    if (!row || (row.shiftLocation && row.shiftLocation !== locationId)) return { error: "That shift could not be found. Ask a manager." };
    const { worker } = row;
    if (!worker.pinHash) return { error: "You have not set a clock-in PIN yet. Set one on your home page in the app first." };
    if (worker.pinLockedUntil && worker.pinLockedUntil.getTime() > Date.now()) {
      return { error: `Too many wrong PINs. Try again after ${PIN_LOCK_MINUTES} minutes, or ask a manager.` };
    }
    if (!(await verifyPin(pin, worker.pinHash))) {
      const failures = worker.pinFailures + 1;
      const locked = failures >= PIN_MAX_FAILURES;
      await tx
        .update(schema.worker)
        .set({ pinFailures: locked ? 0 : failures, pinLockedUntil: locked ? new Date(Date.now() + PIN_LOCK_MINUTES * 60_000) : null })
        .where(eq(schema.worker.id, worker.id));
      if (locked) await log("warn", "clock-in PIN locked", { organisationId, workerId: worker.id, deviceId });
      return { error: locked ? `Too many wrong PINs. Try again after ${PIN_LOCK_MINUTES} minutes, or ask a manager.` : "That PIN is not right. Please try again." };
    }
    if (worker.pinFailures > 0) await tx.update(schema.worker).set({ pinFailures: 0 }).where(eq(schema.worker.id, worker.id));
    const done = await recordClock(tx, {
      organisationId,
      workerId: worker.id,
      actorUserId: worker.userId,
      shiftId,
      kind,
      requestId: reference,
      source: "kiosk",
      kioskLocationId: locationId,
    });
    return done.ok ? { ok: `${worker.fullName.split(" ")[0]}: ${done.ok}` } : { error: done.error! };
  });
  await db.update(schema.kioskDevice).set({ lastSeenAt: new Date() }).where(eq(schema.kioskDevice.id, deviceId));
  // A timestamp makes every result distinct, so the screen can reset itself after showing it.
  return { ...result, at: Date.now() };
}
