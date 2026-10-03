"use server";

import type { LeaveKind } from "@vicisrota/compliance";
import { schema, withOrganisation } from "@vicisrota/db";
import { and, eq, gt } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/business";
import { checkAssignment } from "@/lib/claims";
import { db } from "@/lib/db";
import { LEAVE_KINDS, LEAVE_LABEL } from "@/lib/leave";
import { log } from "@/lib/log";
import { requestId } from "@/lib/request";
import { todayInUk } from "@/lib/rota";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export type FormState = { error?: string; ok?: string };

export async function requestTimeOff(_: FormState, form: FormData): Promise<FormState> {
  const { user, organisationId, worker } = await requireStaff();
  const kind = String(form.get("kind") ?? "") as LeaveKind;
  const startsOn = String(form.get("startsOn") ?? "");
  const endsOn = String(form.get("endsOn") ?? "") || startsOn;
  const amount = Number(form.get("amount") ?? "");
  const note = String(form.get("note") ?? "").trim() || null;
  const unit = worker.irregularHours ? "hours" : "days";
  if (!LEAVE_KINDS.includes(kind)) return { error: "Choose the type of time off." };
  if (!DATE.test(startsOn)) return { error: "Choose the first day off." };
  if (!DATE.test(endsOn) || endsOn < startsOn) return { error: "The last day off must be on or after the first day." };
  if (kind === "annual" && endsOn < todayInUk()) return { error: "Holiday requests need to be for today or later." };
  if (kind === "annual" && !(amount > 0 && amount <= (unit === "hours" ? 2000 : 366)))
    return { error: `Enter how many ${unit} of holiday you need.` };

  await withOrganisation(db, organisationId, async (tx) => {
    const [row] = await tx
      .insert(schema.leaveRequest)
      .values({
        organisationId,
        workerId: worker.id,
        kind,
        startsOn,
        endsOn,
        days: kind === "annual" && unit === "days" ? amount : null,
        hours: kind === "annual" && unit === "hours" ? amount : null,
        note,
        requestedByUserId: user.id,
      })
      .returning({ id: schema.leaveRequest.id });
    await tx.insert(schema.auditEvent).values({
      organisationId,
      actorUserId: user.id,
      requestId: await requestId(),
      action: "create",
      entity: "leave_request",
      entityId: row!.id,
      data: { workerId: worker.id, kind, startsOn, endsOn, selfService: true },
    });
  });
  revalidatePath("/me");
  return { ok: `Your ${LEAVE_LABEL[kind].toLowerCase()} request has been sent. You will see the answer here.` };
}

export async function withdrawRequest(form: FormData) {
  const { user, organisationId, worker } = await requireStaff();
  const id = String(form.get("id") ?? "");
  await withOrganisation(db, organisationId, async (tx) => {
    // Staff can only withdraw their own requests that have not been decided yet.
    const rows = await tx
      .update(schema.leaveRequest)
      .set({ status: "cancelled", decidedByUserId: user.id, decidedAt: new Date() })
      .where(and(eq(schema.leaveRequest.id, id), eq(schema.leaveRequest.workerId, worker.id), eq(schema.leaveRequest.status, "requested")))
      .returning({ id: schema.leaveRequest.id });
    if (!rows.length) return;
    await tx.insert(schema.auditEvent).values({
      organisationId,
      actorUserId: user.id,
      requestId: await requestId(),
      action: "cancel",
      entity: "leave_request",
      entityId: id,
      data: { workerId: worker.id, selfService: true },
    });
  });
  revalidatePath("/me");
}

/** Asks to pick up an open shift or cover a colleague. The legal checks run first, with reasons. */
export async function askToPickUp(_: FormState, form: FormData): Promise<FormState> {
  const { user, organisationId, worker } = await requireStaff();
  const shiftId = String(form.get("shiftId") ?? "");
  const result = await withOrganisation(db, organisationId, async (tx): Promise<FormState> => {
    const [shift] = await tx
      .select()
      .from(schema.shift)
      .where(and(eq(schema.shift.id, shiftId), eq(schema.shift.status, "published"), gt(schema.shift.startsAt, new Date())));
    // Only open shifts and shifts someone has asked to have covered can be picked up.
    if (!shift || shift.workerId === worker.id || (shift.workerId && !shift.coverRequestedAt)) return { error: "That shift is no longer available." };
    const check = await checkAssignment(tx, organisationId, shiftId, worker.id);
    if (!check) return { error: "That shift is no longer available." };
    if (check.blocks.length) return { error: `You can't take this shift: ${check.blocks.map((f) => f.message).join(" ")}` };
    const rows = await tx
      .insert(schema.shiftClaim)
      .values({ organisationId, shiftId, workerId: worker.id, warnings: check.warnings })
      .onConflictDoNothing()
      .returning({ id: schema.shiftClaim.id });
    if (!rows.length) return { error: "You have already asked for this shift." };
    await tx.insert(schema.auditEvent).values({
      organisationId,
      actorUserId: user.id,
      requestId: await requestId(),
      action: "create",
      entity: "shift_claim",
      entityId: rows[0]!.id,
      data: { shiftId, workerId: worker.id, warnings: check.warnings.length },
    });
    return { ok: "Request sent. Your manager will confirm it, and the shift will then appear in your shifts." };
  });
  revalidatePath("/me");
  return result;
}

export async function withdrawClaim(form: FormData) {
  const { user, organisationId, worker } = await requireStaff();
  const id = String(form.get("id") ?? "");
  await withOrganisation(db, organisationId, async (tx) => {
    const rows = await tx
      .update(schema.shiftClaim)
      .set({ status: "withdrawn", decidedByUserId: user.id, decidedAt: new Date() })
      .where(and(eq(schema.shiftClaim.id, id), eq(schema.shiftClaim.workerId, worker.id), eq(schema.shiftClaim.status, "requested")))
      .returning({ id: schema.shiftClaim.id });
    if (!rows.length) return;
    await tx.insert(schema.auditEvent).values({ organisationId, actorUserId: user.id, requestId: await requestId(), action: "withdraw", entity: "shift_claim", entityId: id });
  });
  revalidatePath("/me");
}

/** Asks colleagues to cover one of your shifts, or takes the request back. You keep the shift until a manager approves cover. */
export async function setCoverRequest(form: FormData) {
  const { user, organisationId, worker } = await requireStaff();
  const shiftId = String(form.get("shiftId") ?? "");
  const wanted = form.get("wanted") === "true";
  await withOrganisation(db, organisationId, async (tx) => {
    const rows = await tx
      .update(schema.shift)
      .set({ coverRequestedAt: wanted ? new Date() : null })
      .where(and(eq(schema.shift.id, shiftId), eq(schema.shift.workerId, worker.id), eq(schema.shift.status, "published"), gt(schema.shift.startsAt, new Date())))
      .returning({ id: schema.shift.id });
    if (!rows.length) return;
    if (!wanted) {
      await tx
        .update(schema.shiftClaim)
        .set({ status: "withdrawn", decidedByUserId: user.id, decidedAt: new Date() })
        .where(and(eq(schema.shiftClaim.shiftId, shiftId), eq(schema.shiftClaim.status, "requested")));
    }
    await tx.insert(schema.auditEvent).values({
      organisationId,
      actorUserId: user.id,
      requestId: await requestId(),
      action: wanted ? "request_cover" : "cancel_cover",
      entity: "shift",
      entityId: shiftId,
    });
  });
  revalidatePath("/me");
}

const LONE_KINDS = ["start", "ok", "finished", "help"] as const;

/** A lone working check-in on the person's own shift: started, OK, finished safely, or a call for help. */
export async function loneCheckIn(_: FormState, form: FormData): Promise<FormState> {
  const { user, organisationId, worker } = await requireStaff();
  const shiftId = String(form.get("shiftId") ?? "");
  const kind = String(form.get("kind") ?? "") as (typeof LONE_KINDS)[number];
  const note = String(form.get("note") ?? "").trim().slice(0, 1000) || null;
  if (!LONE_KINDS.includes(kind)) return { error: "Something went wrong. Please try again." };
  const result = await withOrganisation(db, organisationId, async (tx): Promise<FormState> => {
    const [shift] = await tx
      .select({ id: schema.shift.id })
      .from(schema.shift)
      .where(and(eq(schema.shift.id, shiftId), eq(schema.shift.workerId, worker.id), eq(schema.shift.loneWorking, true), eq(schema.shift.status, "published")));
    if (!shift) return { error: "That shift could not be found." };
    await tx.insert(schema.loneWorkCheck).values({ organisationId, shiftId, actorUserId: user.id, actorName: worker.fullName, kind, note });
    await tx.insert(schema.auditEvent).values({ organisationId, actorUserId: user.id, requestId: await requestId(), action: `lone_${kind}`, entity: "shift", entityId: shiftId });
    return {
      ok: {
        start: "Thanks. You have checked in.",
        ok: "Thanks. Glad you are OK.",
        finished: "Thanks. You have checked out. Get home safely.",
        help: "Your manager has been alerted. If you are in danger, call 999 now.",
      }[kind],
    };
  });
  if (kind === "help" && !result.error) await log("warn", "lone worker asked for help", { organisationId, shiftId });
  revalidatePath("/me");
  return result;
}
