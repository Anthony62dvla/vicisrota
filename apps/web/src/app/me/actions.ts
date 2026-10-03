"use server";

import type { LeaveKind } from "@vicisrota/compliance";
import { schema, withOrganisation } from "@vicisrota/db";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/business";
import { db } from "@/lib/db";
import { LEAVE_KINDS, LEAVE_LABEL } from "@/lib/leave";
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
