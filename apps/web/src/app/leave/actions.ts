"use server";

import { FAMILY_LEAVE, isFamilyLeave, type LeaveKind } from "@vicisrota/compliance";
import { schema, withOrganisation } from "@vicisrota/db";
import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireManager } from "@/lib/business";
import { db } from "@/lib/db";
import { clashNote, formatAmount, LEAVE_KINDS, LEAVE_LABEL, loadBalances } from "@/lib/leave";
import { requestId } from "@/lib/request";
import { todayInUk } from "@/lib/rota";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export type FormState = { error?: string; ok?: string };

export async function bookLeave(_: FormState, form: FormData): Promise<FormState> {
  const { user, organisationId } = await requireManager();
  const workerId = String(form.get("workerId") ?? "");
  const kind = String(form.get("kind") ?? "") as LeaveKind;
  const startsOn = String(form.get("startsOn") ?? "");
  const endsOn = String(form.get("endsOn") ?? "") || startsOn;
  const amount = Number(form.get("amount") ?? "");
  const note = String(form.get("note") ?? "").trim() || null;
  const approveNow = form.get("approveNow") === "on";
  if (!LEAVE_KINDS.includes(kind)) return { error: "Choose the type of leave." };
  if (!DATE.test(startsOn)) return { error: "Enter the first day of leave." };
  if (!DATE.test(endsOn) || endsOn < startsOn) return { error: "The last day must be on or after the first day." };

  const result = await withOrganisation(db, organisationId, async (tx): Promise<FormState> => {
    const [worker] = await tx.select().from(schema.worker).where(eq(schema.worker.id, workerId));
    if (!worker) return { error: "That person could not be found." };
    const unit = worker.irregularHours ? "hours" : "days";
    if (kind === "annual" && !(amount > 0 && amount <= (unit === "hours" ? 2000 : 366)))
      return { error: `Enter how many ${unit} of holiday this uses.` };
    const [row] = await tx
      .insert(schema.leaveRequest)
      .values({
        organisationId,
        workerId,
        kind,
        startsOn,
        endsOn,
        days: kind === "annual" && unit === "days" ? amount : null,
        hours: kind === "annual" && unit === "hours" ? amount : null,
        note,
        status: approveNow ? "approved" : "requested",
        requestedByUserId: user.id,
        decidedByUserId: approveNow ? user.id : null,
        decidedAt: approveNow ? new Date() : null,
      })
      .returning({ id: schema.leaveRequest.id });
    await tx.insert(schema.auditEvent).values({
      organisationId,
      actorUserId: user.id,
      requestId: await requestId(),
      action: approveNow ? "approve" : "create",
      entity: "leave_request",
      entityId: row!.id,
      // The note may hold health details, so it stays out of the audit trail.
      data: { workerId, kind, startsOn, endsOn, amount: kind === "annual" ? amount : null },
    });
    const what = `${LEAVE_LABEL[kind]} for ${worker.fullName}`;
    return { ok: approveNow ? `${what} booked and approved.${await clashNote(tx, workerId, startsOn, endsOn)}` : `${what} added as a request.` };
  });
  revalidatePath("/leave");
  revalidatePath("/rota");
  revalidatePath("/sickness");
  return result;
}

export async function decideLeave(_: FormState, form: FormData): Promise<FormState> {
  const { user, organisationId } = await requireManager();
  const id = String(form.get("id") ?? "");
  const decision = String(form.get("decision") ?? "");
  if (!["approved", "declined", "cancelled"].includes(decision)) return { error: "Choose approve, decline or cancel." };
  const status = decision as "approved" | "declined" | "cancelled";

  const result = await withOrganisation(db, organisationId, async (tx): Promise<FormState> => {
    // Only open requests can be approved or declined; approved leave can be cancelled.
    const allowedFrom = status === "cancelled" ? (["requested", "approved"] as const) : (["requested"] as const);
    const [row] = await tx
      .update(schema.leaveRequest)
      .set({ status, decidedByUserId: user.id, decidedAt: new Date() })
      .where(and(eq(schema.leaveRequest.id, id), inArray(schema.leaveRequest.status, [...allowedFrom])))
      .returning();
    if (!row) return { error: "That leave has already been dealt with. Refresh the page to see its current state." };
    await tx.insert(schema.auditEvent).values({
      organisationId,
      actorUserId: user.id,
      requestId: await requestId(),
      action: status === "approved" ? "approve" : status === "declined" ? "decline" : "cancel",
      entity: "leave_request",
      entityId: id,
      data: { workerId: row.workerId, startsOn: row.startsOn, endsOn: row.endsOn },
    });
    const [worker] = await tx.select({ name: schema.worker.fullName }).from(schema.worker).where(eq(schema.worker.id, row.workerId));
    const name = worker?.name ?? "This person";
    if (status !== "approved") return { ok: `${LEAVE_LABEL[row.kind]} for ${name} ${status}.` };
    let over = "";
    if (row.kind === "annual") {
      const { balances } = await loadBalances(tx, organisationId, todayInUk());
      const b = balances.get(row.workerId);
      if (b && b.remaining < 0) over = ` This takes ${name} ${formatAmount(-b.remaining, b.unit)} over their holiday entitlement for the year.`;
    }
    return { ok: `${LEAVE_LABEL[row.kind]} for ${name} approved.${over}${await clashNote(tx, row.workerId, row.startsOn, row.endsOn)}` };
  });
  revalidatePath("/leave");
  revalidatePath("/rota");
  revalidatePath("/sickness");
  return result;
}

/**
 * Records a keeping in touch day (or SPLIT day) during maternity, adoption or shared parental leave. A shift
 * can then go on the rota that day. The legal limit is never passed, as working more could end the leave.
 */
export async function addKeepingInTouchDay(_: FormState, form: FormData): Promise<FormState> {
  const { user, organisationId } = await requireManager();
  const leaveRequestId = String(form.get("leaveRequestId") ?? "");
  const workedOn = String(form.get("workedOn") ?? "");
  const note = String(form.get("note") ?? "").trim().slice(0, 200) || null;
  if (!DATE.test(workedOn)) return { error: "Choose the day." };
  const result = await withOrganisation(db, organisationId, async (tx): Promise<FormState> => {
    const [leave] = await tx.select().from(schema.leaveRequest).where(and(eq(schema.leaveRequest.id, leaveRequestId), eq(schema.leaveRequest.status, "approved")));
    const limit = leave && isFamilyLeave(leave.kind) ? FAMILY_LEAVE[leave.kind].keepingInTouchDays : null;
    if (!leave || limit == null) return { error: "Keeping in touch days are only for approved maternity, adoption or shared parental leave." };
    if (workedOn < leave.startsOn || workedOn > leave.endsOn) return { error: "The day must be during the leave." };
    const used = await tx.select({ id: schema.keepingInTouchDay.id }).from(schema.keepingInTouchDay).where(eq(schema.keepingInTouchDay.leaveRequestId, leaveRequestId));
    if (used.length >= limit) return { error: `All ${limit} days have been used. Working more could end the leave, so this has not been added.` };
    const rows = await tx
      .insert(schema.keepingInTouchDay)
      .values({ organisationId, leaveRequestId, workerId: leave.workerId, workedOn, note, createdByUserId: user.id })
      .onConflictDoNothing()
      .returning({ id: schema.keepingInTouchDay.id });
    if (!rows.length) return { error: "That day is already recorded." };
    await tx.insert(schema.auditEvent).values({
      organisationId,
      actorUserId: user.id,
      requestId: await requestId(),
      action: "create",
      entity: "keeping_in_touch_day",
      entityId: rows[0]!.id,
      data: { leaveRequestId, workerId: leave.workerId, workedOn },
    });
    return { ok: `Day added: ${used.length + 1} of ${limit} used. You can now put a shift on the rota that day.` };
  });
  revalidatePath("/leave");
  revalidatePath("/rota");
  return result;
}

export async function removeKeepingInTouchDay(form: FormData) {
  const { user, organisationId } = await requireManager();
  const id = String(form.get("id") ?? "");
  await withOrganisation(db, organisationId, async (tx) => {
    const rows = await tx.delete(schema.keepingInTouchDay).where(eq(schema.keepingInTouchDay.id, id)).returning({ workedOn: schema.keepingInTouchDay.workedOn });
    if (!rows.length) return;
    await tx.insert(schema.auditEvent).values({ organisationId, actorUserId: user.id, requestId: await requestId(), action: "delete", entity: "keeping_in_touch_day", entityId: id, data: { workedOn: rows[0]!.workedOn } });
  });
  revalidatePath("/leave");
  revalidatePath("/rota");
}
