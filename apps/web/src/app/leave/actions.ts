"use server";

import { addDays, londonDateTime, type LeaveKind } from "@vicisrota/compliance";
import { schema, withOrganisation, type Transaction } from "@vicisrota/db";
import { and, eq, gt, inArray, lt, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireManager } from "@/lib/business";
import { db } from "@/lib/db";
import { formatAmount, LEAVE_KINDS, LEAVE_LABEL, loadBalances } from "@/lib/leave";
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
  return result;
}

/** Shifts already on the rota during the leave, so the manager knows to move them. */
const clashNote = async (tx: Transaction, workerId: string, startsOn: string, endsOn: string) => {
  const shifts = await tx
    .select({ id: schema.shift.id })
    .from(schema.shift)
    .where(
      and(
        eq(schema.shift.workerId, workerId),
        ne(schema.shift.status, "cancelled"),
        // Shifts touching any day of the leave, including overnight shifts that run into it.
        lt(schema.shift.startsAt, new Date(londonDateTime(addDays(endsOn, 1), "00:00"))),
        gt(schema.shift.endsAt, new Date(londonDateTime(startsOn, "00:00"))),
      ),
    );
  return shifts.length
    ? ` They have ${shifts.length} shift${shifts.length === 1 ? "" : "s"} on the rota during this leave, which ${shifts.length === 1 ? "needs" : "need"} moving to someone else.`
    : "";
};

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
  return result;
}
