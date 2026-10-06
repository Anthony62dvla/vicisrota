"use server";

import { schema, withOrganisation } from "@vicisrota/db";
import { and, eq, gt, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/business";
import { canWorkRole, checkSwap, staffBlockMessage } from "@/lib/claims";
import { db } from "@/lib/db";
import { notifyWorkers, type Notify } from "@/lib/notify";
import { requestId } from "@/lib/request";
import { loadOpenSwaps, shiftWhen, swapStillValid } from "@/lib/swaps";

export type SwapState = { error?: string; ok?: string };

const NOTE_MAX = 300;

/**
 * Asks a named colleague to swap: you take their shift and they take yours. The legal checks run both ways
 * first. Nothing changes until the colleague agrees and a manager approves.
 */
export async function askToSwap(_: SwapState, form: FormData): Promise<SwapState> {
  const { user, organisationId, worker } = await requireStaff();
  const myShiftId = String(form.get("myShiftId") ?? "");
  const theirShiftId = String(form.get("theirShiftId") ?? "");
  const note = String(form.get("note") ?? "").trim().slice(0, NOTE_MAX) || null;
  let tell: Notify | null = null;
  const result = await withOrganisation(db, organisationId, async (tx): Promise<SwapState> => {
    const now = new Date();
    const [mine] = await tx
      .select()
      .from(schema.shift)
      .where(and(eq(schema.shift.id, myShiftId), eq(schema.shift.workerId, worker.id), eq(schema.shift.status, "published"), gt(schema.shift.startsAt, now)));
    const [theirs] = await tx.select().from(schema.shift).where(and(eq(schema.shift.id, theirShiftId), eq(schema.shift.status, "published"), gt(schema.shift.startsAt, now)));
    if (!mine) return { error: "That shift of yours can no longer be swapped." };
    if (!theirs?.workerId || theirs.workerId === worker.id) return { error: "That shift is no longer available to swap." };
    const colleagueId = theirs.workerId;
    if (!(await canWorkRole(tx, worker.id, theirs.roleId))) return { error: "Their shift is for a job role you are not set up for." };
    if (!(await canWorkRole(tx, colleagueId, mine.roleId))) return { error: "Your shift is for a job role they are not set up for." };
    const check = await checkSwap(tx, organisationId, { shiftId: mine.id, workerId: worker.id }, { shiftId: theirs.id, workerId: colleagueId });
    if (!check) return { error: "That shift is no longer available to swap." };
    if (check.blocks.length) return { error: `This swap can't happen: ${staffBlockMessage(check.blocks)}` };
    const rows = await tx
      .insert(schema.shiftSwap)
      .values({ organisationId, fromShiftId: mine.id, fromWorkerId: worker.id, toShiftId: theirs.id, toWorkerId: colleagueId, note, warnings: check.warnings })
      .onConflictDoNothing()
      .returning({ id: schema.shiftSwap.id });
    if (!rows.length) return { error: "You have already asked to swap this shift. Withdraw that request first if you want to ask someone else." };
    const id = rows[0]!.id;
    await tx.insert(schema.auditEvent).values({
      organisationId,
      actorUserId: user.id,
      requestId: await requestId(),
      action: "create",
      entity: "shift_swap",
      entityId: id,
      data: { fromShiftId: mine.id, toShiftId: theirs.id, toWorkerId: colleagueId, warnings: check.warnings.length },
    });
    const first = worker.fullName.split(" ")[0];
    tell = {
      workerId: colleagueId,
      purpose: "swap",
      title: "A swap request",
      body: `${first} would like to swap: you take their shift on ${shiftWhen(mine)}, and they take yours on ${shiftWhen(theirs)}. Open VicisRota to say yes or no.`,
      url: "/me#swaps-heading",
      dedupeKey: `swap-asked:${id}`,
    };
    return { ok: "Request sent. They can say yes or no, and then your manager approves it. You keep your shift until then." };
  });
  if (tell) await notifyWorkers(organisationId, [tell]);
  revalidatePath("/me");
  return result;
}

/** The colleague says yes or no. A yes sends it to a manager; the checks run again first. */
export async function answerSwap(_: SwapState, form: FormData): Promise<SwapState> {
  const { user, organisationId, worker } = await requireStaff();
  const id = String(form.get("swapId") ?? "");
  const yes = form.get("answer") === "yes";
  let tell: Notify | null = null;
  const result = await withOrganisation(db, organisationId, async (tx): Promise<SwapState> => {
    const row = (await loadOpenSwaps(tx, worker.id)).find((r) => r.swap.id === id && r.swap.toWorkerId === worker.id && r.swap.status === "asked");
    if (!row) return { error: "That request has already been dealt with." };
    const audit = async (action: string) =>
      tx.insert(schema.auditEvent).values({ organisationId, actorUserId: user.id, requestId: await requestId(), action, entity: "shift_swap", entityId: id });
    if (yes) {
      if (!swapStillValid(row)) return { error: "One of the shifts has changed since this was asked, so it can't be swapped now." };
      const check = await checkSwap(tx, organisationId, { shiftId: row.fromShift.id, workerId: row.swap.fromWorkerId }, { shiftId: row.toShift.id, workerId: worker.id });
      if (!check) return { error: "One of the shifts no longer exists." };
      if (check.blocks.length) return { error: `This swap can't happen now: ${staffBlockMessage(check.blocks)}` };
      await tx.update(schema.shiftSwap).set({ status: "agreed", respondedAt: new Date(), warnings: check.warnings }).where(eq(schema.shiftSwap.id, id));
      await audit("agree");
      return { ok: "Thank you. Your manager will now look at the swap. You keep your own shift until they approve it." };
    }
    await tx.update(schema.shiftSwap).set({ status: "colleague_declined", respondedAt: new Date() }).where(eq(schema.shiftSwap.id, id));
    await audit("decline");
    tell = {
      workerId: row.swap.fromWorkerId,
      purpose: "swap",
      title: "Swap not possible",
      body: `${worker.fullName.split(" ")[0]} can't swap with you this time. You still have your shift on ${shiftWhen(row.fromShift)}.`,
      url: "/me",
      dedupeKey: `swap-declined:${id}`,
    };
    return { ok: "Done. They have been told, kindly, that it isn't possible this time." };
  });
  if (tell) await notifyWorkers(organisationId, [tell]);
  revalidatePath("/me");
  return result;
}

/** The person who asked takes the request back, before a manager decides. */
export async function withdrawSwap(form: FormData) {
  const { user, organisationId, worker } = await requireStaff();
  const id = String(form.get("swapId") ?? "");
  await withOrganisation(db, organisationId, async (tx) => {
    const rows = await tx
      .update(schema.shiftSwap)
      .set({ status: "withdrawn", decidedByUserId: user.id, decidedAt: new Date() })
      .where(and(eq(schema.shiftSwap.id, id), eq(schema.shiftSwap.fromWorkerId, worker.id), inArray(schema.shiftSwap.status, ["asked", "agreed"])))
      .returning({ status: schema.shiftSwap.status });
    if (!rows.length) return;
    await tx.insert(schema.auditEvent).values({ organisationId, actorUserId: user.id, requestId: await requestId(), action: "withdraw", entity: "shift_swap", entityId: id });
  });
  revalidatePath("/me");
}
