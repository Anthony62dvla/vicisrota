"use server";

import { schema, withOrganisation } from "@vicisrota/db";
import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { recordClock } from "@/lib/clock";
import { db } from "@/lib/db";
import { scannedTablet } from "@/lib/qr-clock";
import { requestId } from "@/lib/request";

export type QrClockState = { error?: string; ok?: string };

const KINDS = ["in", "break_start", "break_end", "out"] as const;

/** Clock in or out after scanning the code on a clock-in tablet. The code is checked again, so it must still be recent. */
export async function qrClock(_: QrClockState, form: FormData): Promise<QrClockState> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { error: "Please sign in, then scan the code again." };
  const kind = String(form.get("kind") ?? "") as (typeof KINDS)[number];
  if (!KINDS.includes(kind)) return { error: "Something went wrong. Please try again." };
  const shiftId = String(form.get("shiftId") ?? "");
  const scan = await scannedTablet({ k: String(form.get("k") ?? ""), w: String(form.get("w") ?? ""), s: String(form.get("s") ?? "") });
  if ("error" in scan) return { error: "The code has changed since you scanned it. Please scan the code on the tablet again." };
  const { organisationId, locationId } = scan.device;
  const reference = await requestId();
  return withOrganisation(db, organisationId, async (tx): Promise<QrClockState> => {
    const [row] = await tx
      .select({ worker: schema.worker, shiftLocation: schema.shift.locationId })
      .from(schema.shift)
      .innerJoin(schema.worker, eq(schema.shift.workerId, schema.worker.id))
      .where(and(eq(schema.shift.id, shiftId), eq(schema.worker.userId, session.user.id)));
    // Only your own shift, and only at the workplace the tablet is at.
    if (!row || (row.shiftLocation && row.shiftLocation !== locationId)) return { error: "That shift could not be found here. Ask a manager." };
    return recordClock(tx, {
      organisationId,
      workerId: row.worker.id,
      actorUserId: session.user.id,
      shiftId,
      kind,
      requestId: reference,
      source: "qr",
      kioskLocationId: locationId,
    });
  });
}
