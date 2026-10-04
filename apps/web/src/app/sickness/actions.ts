"use server";

import { schema, withOrganisation } from "@vicisrota/db";
import { and, eq, gte, inArray, lte } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireManager } from "@/lib/business";
import { db } from "@/lib/db";
import { clashNote } from "@/lib/leave";
import { requestId } from "@/lib/request";
import { todayInUk } from "@/lib/rota";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export type FormState = { error?: string; ok?: string; values?: Record<string, string> };

const refresh = () => {
  revalidatePath("/sickness");
  revalidatePath("/leave");
  revalidatePath("/rota");
  revalidatePath("/timesheets");
};

export async function recordSickness(_: FormState, form: FormData): Promise<FormState> {
  const { user, organisationId } = await requireManager();
  const workerId = String(form.get("workerId") ?? "");
  const startsOn = String(form.get("startsOn") ?? "");
  const endsOn = String(form.get("endsOn") ?? "") || startsOn;
  const values = { workerId, startsOn, endsOn: String(form.get("endsOn") ?? "") };
  if (!DATE.test(startsOn)) return { error: "Enter the first day they were off sick.", values };
  if (!DATE.test(endsOn) || endsOn < startsOn) return { error: "The last day must be on or after the first day.", values };

  const result = await withOrganisation(db, organisationId, async (tx): Promise<FormState> => {
    const [worker] = await tx.select().from(schema.worker).where(eq(schema.worker.id, workerId));
    if (!worker) return { error: "Choose who was off sick.", values };
    const [overlap] = await tx
      .select({ id: schema.leaveRequest.id })
      .from(schema.leaveRequest)
      .where(
        and(
          eq(schema.leaveRequest.workerId, workerId),
          eq(schema.leaveRequest.kind, "sick"),
          inArray(schema.leaveRequest.status, ["requested", "approved"]),
          lte(schema.leaveRequest.startsOn, endsOn),
          gte(schema.leaveRequest.endsOn, startsOn),
        ),
      );
    if (overlap) return { error: `${worker.fullName} already has sickness recorded on some of those days. Change that instead.`, values };
    const [row] = await tx
      .insert(schema.leaveRequest)
      .values({
        organisationId,
        workerId,
        kind: "sick",
        startsOn,
        endsOn,
        status: "approved",
        requestedByUserId: user.id,
        decidedByUserId: user.id,
        decidedAt: new Date(),
      })
      .returning({ id: schema.leaveRequest.id });
    await tx.insert(schema.auditEvent).values({
      organisationId,
      actorUserId: user.id,
      requestId: await requestId(),
      action: "approve",
      entity: "leave_request",
      entityId: row!.id,
      data: { workerId, kind: "sick", startsOn, endsOn },
    });
    return { ok: `Sickness recorded for ${worker.fullName}.${await clashNote(tx, workerId, startsOn, endsOn)}` };
  });
  refresh();
  return result;
}

/** The sickness this action may change: approved sickness in this business. */
const findSpell = (id: string) => and(eq(schema.leaveRequest.id, id), eq(schema.leaveRequest.kind, "sick"), eq(schema.leaveRequest.status, "approved"));

export async function setLastSickDay(_: FormState, form: FormData): Promise<FormState> {
  const { user, organisationId } = await requireManager();
  const id = String(form.get("id") ?? "");
  const endsOn = String(form.get("endsOn") ?? "");
  if (!DATE.test(endsOn)) return { error: "Enter the last day they were off sick." };
  const result = await withOrganisation(db, organisationId, async (tx): Promise<FormState> => {
    const [spell] = await tx.select().from(schema.leaveRequest).where(findSpell(id));
    if (!spell) return { error: "That sickness could not be found. Refresh the page." };
    if (endsOn < spell.startsOn) return { error: "The last day cannot be before the first day." };
    await tx.update(schema.leaveRequest).set({ endsOn }).where(findSpell(id));
    await tx.insert(schema.auditEvent).values({
      organisationId,
      actorUserId: user.id,
      requestId: await requestId(),
      action: "update",
      entity: "leave_request",
      entityId: id,
      data: { endsOn: { from: spell.endsOn, to: endsOn } },
    });
    return { ok: "Last day changed." };
  });
  refresh();
  return result;
}

export async function recordFitNote(_: FormState, form: FormData): Promise<FormState> {
  const { user, organisationId } = await requireManager();
  const id = String(form.get("id") ?? "");
  const result = await withOrganisation(db, organisationId, async (tx): Promise<FormState> => {
    const [row] = await tx.update(schema.leaveRequest).set({ fitNoteOn: todayInUk() }).where(findSpell(id)).returning({ id: schema.leaveRequest.id });
    if (!row) return { error: "That sickness could not be found. Refresh the page." };
    await tx.insert(schema.auditEvent).values({
      organisationId,
      actorUserId: user.id,
      requestId: await requestId(),
      action: "fit_note",
      entity: "leave_request",
      entityId: id,
      data: {},
    });
    return { ok: "Fit note recorded." };
  });
  refresh();
  return result;
}

export async function setSspEarnings(_: FormState, form: FormData): Promise<FormState> {
  const { user, organisationId } = await requireManager();
  const id = String(form.get("id") ?? "");
  const raw = String(form.get("pounds") ?? "").trim().replace(/^£/, "");
  const pence = raw === "" ? null : Math.round(Number(raw) * 100);
  if (pence !== null && !(Number.isFinite(pence) && pence >= 0 && pence <= 10_000_000))
    return { error: "Enter average weekly earnings in pounds, for example 412.50, or leave it empty to use the estimate." };
  const result = await withOrganisation(db, organisationId, async (tx): Promise<FormState> => {
    const [row] = await tx
      .update(schema.leaveRequest)
      .set({ sspWeeklyEarningsPence: pence })
      .where(findSpell(id))
      .returning({ id: schema.leaveRequest.id });
    if (!row) return { error: "That sickness could not be found. Refresh the page." };
    await tx.insert(schema.auditEvent).values({
      organisationId,
      actorUserId: user.id,
      requestId: await requestId(),
      action: "update",
      entity: "leave_request",
      entityId: id,
      data: { sspWeeklyEarningsPence: pence },
    });
    return { ok: pence === null ? "Using the estimate from confirmed hours." : "Average weekly earnings saved." };
  });
  refresh();
  return result;
}
