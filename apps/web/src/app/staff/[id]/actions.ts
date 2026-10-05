"use server";

import { schema, withOrganisation, type Transaction } from "@vicisrota/db";
import { and, eq, gte, isNull, sql } from "drizzle-orm";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { addUnavailable, parseSlot, removeUnavailable } from "@/lib/availability";
import { requireManager } from "@/lib/business";
import { db } from "@/lib/db";
import { hashInviteToken, INVITE_DAYS, newInviteToken } from "@/lib/invite";
import { addingBlocked } from "@/lib/plan";
import { requestId } from "@/lib/request";
import { appUrl, sendTexts, smsConfigured } from "@/lib/sms";
import { formatUkMobile, inviteText, normaliseUkMobile } from "@vicisrota/messaging";
import { addDays, londonDateTime } from "@vicisrota/compliance";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const DBS_LEVELS = ["basic", "standard", "enhanced", "enhanced_barred"] as const;
type DbsLevel = (typeof DBS_LEVELS)[number];

/** values: what was typed, sent back on an error so the form is not cleared. */
export type FormState = { error?: string; ok?: string; values?: Record<string, string> };

const optionalDate = (value: FormDataEntryValue | null) => {
  const s = String(value ?? "");
  return DATE.test(s) ? s : null;
};

/** Foreign keys skip row-level security, so confirm the person belongs to this business first. */
const findWorker = async (tx: Transaction, workerId: string) =>
  (await tx.select({ id: schema.worker.id, name: schema.worker.fullName }).from(schema.worker).where(eq(schema.worker.id, workerId)))[0];

export async function addCheck(_: FormState, form: FormData): Promise<FormState> {
  const { user, organisationId } = await requireManager();
  const workerId = String(form.get("workerId") ?? "");
  const kind = String(form.get("kind") ?? "");
  const checkedOn = String(form.get("checkedOn") ?? "");
  const expiresOn = optionalDate(form.get("expiresOn"));
  const level = String(form.get("dbsLevel") ?? "");
  const reference = String(form.get("reference") ?? "").trim() || null;
  if (kind !== "right_to_work" && kind !== "dbs") return { error: "Choose the type of check." };
  if (!DATE.test(checkedOn)) return { error: "Enter the date the check was done." };
  if (kind === "dbs" && !DBS_LEVELS.includes(level as DbsLevel)) return { error: "Choose the DBS level." };
  if (expiresOn && expiresOn < checkedOn) return { error: "The follow-up date must be after the check date." };

  const result = await withOrganisation(db, organisationId, async (tx) => {
    const worker = await findWorker(tx, workerId);
    if (!worker) return { error: "That person could not be found." };
    const [row] = await tx
      .insert(schema.workerCheck)
      .values({
        organisationId,
        workerId,
        kind,
        checkedOn,
        expiresOn: kind === "right_to_work" ? expiresOn : null,
        dbsLevel: kind === "dbs" ? (level as DbsLevel) : null,
        reference,
      })
      .returning({ id: schema.workerCheck.id });
    await tx.insert(schema.auditEvent).values({
      organisationId,
      actorUserId: user.id,
      requestId: await requestId(),
      action: "create",
      entity: "worker_check",
      entityId: row!.id,
      // The reference (share code or certificate number) stays out of the audit trail.
      data: { workerId, kind, checkedOn, expiresOn, dbsLevel: kind === "dbs" ? level : null },
    });
    return { ok: `${kind === "dbs" ? "DBS check" : "Right to work check"} recorded for ${worker.name}.` };
  });
  revalidatePath(`/staff/${workerId}`);
  return result;
}

export async function addTraining(_: FormState, form: FormData): Promise<FormState> {
  const { user, organisationId } = await requireManager();
  const workerId = String(form.get("workerId") ?? "");
  const name = String(form.get("name") ?? "").trim();
  const achievedOn = optionalDate(form.get("achievedOn"));
  const expiresOn = optionalDate(form.get("expiresOn"));
  if (!name) return { error: "Enter the name of the training." };
  if (achievedOn && expiresOn && expiresOn < achievedOn) return { error: "The expiry date must be after the date it was achieved." };

  const result = await withOrganisation(db, organisationId, async (tx) => {
    const worker = await findWorker(tx, workerId);
    if (!worker) return { error: "That person could not be found." };
    // Reuse the business's existing training type when the name matches, ignoring case.
    let [type] = await tx
      .select({ id: schema.qualification.id, name: schema.qualification.name })
      .from(schema.qualification)
      .where(sql`lower(${schema.qualification.name}) = lower(${name})`);
    if (!type) {
      [type] = await tx.insert(schema.qualification).values({ organisationId, name }).returning({ id: schema.qualification.id, name: schema.qualification.name });
    }
    const [row] = await tx
      .insert(schema.workerQualification)
      .values({ organisationId, workerId, qualificationId: type!.id, achievedOn, expiresOn })
      .returning({ id: schema.workerQualification.id });
    await tx.insert(schema.auditEvent).values({
      organisationId,
      actorUserId: user.id,
      requestId: await requestId(),
      action: "create",
      entity: "worker_qualification",
      entityId: row!.id,
      data: { workerId, qualification: type!.name, achievedOn, expiresOn },
    });
    return { ok: `${type!.name} recorded for ${worker.name}.` };
  });
  revalidatePath(`/staff/${workerId}`);
  return result;
}

export async function removeTraining(form: FormData) {
  const { user, organisationId } = await requireManager();
  const id = String(form.get("id") ?? "");
  const workerId = String(form.get("workerId") ?? "");
  await withOrganisation(db, organisationId, async (tx) => {
    const rows = await tx
      .delete(schema.workerQualification)
      .where(and(eq(schema.workerQualification.id, id), eq(schema.workerQualification.workerId, workerId)))
      .returning({ id: schema.workerQualification.id });
    if (!rows.length) return;
    await tx.insert(schema.auditEvent).values({
      organisationId,
      actorUserId: user.id,
      requestId: await requestId(),
      action: "delete",
      entity: "worker_qualification",
      entityId: id,
      data: { workerId },
    });
  });
  revalidatePath(`/staff/${workerId}`);
}

export async function updateHolidaySettings(_: FormState, form: FormData): Promise<FormState> {
  const { user, organisationId } = await requireManager();
  const workerId = String(form.get("workerId") ?? "");
  const employmentStart = optionalDate(form.get("employmentStart"));
  const daysPerWeek = Number(form.get("daysPerWeek") ?? "");
  const irregularHours = form.get("irregularHours") === "on";
  if (!(daysPerWeek > 0 && daysPerWeek <= 7)) return { error: "Enter the usual days worked a week, between 0.5 and 7." };

  const result = await withOrganisation(db, organisationId, async (tx) => {
    const rows = await tx
      .update(schema.worker)
      .set({ employmentStart, daysPerWeek, irregularHours })
      .where(eq(schema.worker.id, workerId))
      .returning({ name: schema.worker.fullName });
    if (!rows.length) return { error: "That person could not be found." };
    await tx.insert(schema.auditEvent).values({
      organisationId,
      actorUserId: user.id,
      requestId: await requestId(),
      action: "update",
      entity: "worker",
      entityId: workerId,
      data: { employmentStart, daysPerWeek, irregularHours },
    });
    return { ok: `Holiday settings saved for ${rows[0]!.name}.` };
  });
  revalidatePath(`/staff/${workerId}`);
  revalidatePath("/leave");
  return result;
}

/** The person's employee number in the business's payroll software. */
export async function updatePayrollId(_: FormState, form: FormData): Promise<FormState> {
  const { user, organisationId } = await requireManager();
  const workerId = String(form.get("workerId") ?? "");
  const payrollId = String(form.get("payrollId") ?? "").trim() || null;
  if (payrollId && payrollId.length > 40) return { error: "Keep the payroll ID under 40 characters." };
  const result = await withOrganisation(db, organisationId, async (tx) => {
    const rows = await tx.update(schema.worker).set({ payrollId }).where(eq(schema.worker.id, workerId)).returning({ name: schema.worker.fullName });
    if (!rows.length) return { error: "That person could not be found." };
    await tx.insert(schema.auditEvent).values({ organisationId, actorUserId: user.id, requestId: await requestId(), action: "update", entity: "worker", entityId: workerId, data: { payrollId } });
    return { ok: payrollId ? `Payroll ID saved for ${rows[0]!.name}.` : `Payroll ID removed for ${rows[0]!.name}.` };
  });
  revalidatePath(`/staff/${workerId}`);
  revalidatePath("/timesheets");
  return result;
}

/** Records that a supervision or appraisal happened, and when the next is due. Only dates are kept. */
export async function addSupervision(_: FormState, form: FormData): Promise<FormState> {
  const { user, organisationId } = await requireManager();
  const workerId = String(form.get("workerId") ?? "");
  const kind = String(form.get("kind") ?? "");
  const heldOn = optionalDate(form.get("heldOn"));
  const nextDueOn = optionalDate(form.get("nextDueOn"));
  if (kind !== "supervision" && kind !== "appraisal") return { error: "Choose supervision or appraisal." };
  if (!heldOn) return { error: "Enter the date it was held." };
  if (nextDueOn && nextDueOn <= heldOn) return { error: "The next one should be due after this one." };
  const result = await withOrganisation(db, organisationId, async (tx) => {
    const worker = await findWorker(tx, workerId);
    if (!worker) return { error: "That person could not be found." };
    const [row] = await tx.insert(schema.supervision).values({ organisationId, workerId, kind, heldOn, nextDueOn, recordedByUserId: user.id }).returning({ id: schema.supervision.id });
    await tx.insert(schema.auditEvent).values({ organisationId, actorUserId: user.id, requestId: await requestId(), action: "create", entity: "supervision", entityId: row!.id, data: { workerId, kind, heldOn, nextDueOn } });
    return { ok: `${kind === "supervision" ? "Supervision" : "Appraisal"} recorded for ${worker.name}.` };
  });
  revalidatePath(`/staff/${workerId}`);
  revalidatePath("/inspection");
  return result;
}

export type InviteState = FormState & { link?: string };

/** Creates a fresh invitation link for a member of staff; any earlier unused link stops working. */
export async function inviteStaff(_: InviteState, form: FormData): Promise<InviteState> {
  const { user, organisationId, businessName } = await requireManager();
  const workerId = String(form.get("workerId") ?? "");
  const byText = form.get("byText") === "on";
  const token = newInviteToken();

  const result = await withOrganisation(db, organisationId, async (tx): Promise<InviteState & { mobile?: string | null }> => {
    const worker = await findWorker(tx, workerId);
    if (!worker) return { error: "That person could not be found." };
    const [linked] = await tx.select({ userId: schema.worker.userId, mobile: schema.worker.mobile }).from(schema.worker).where(eq(schema.worker.id, workerId));
    if (linked?.userId) return { error: `${worker.name} already has a login.` };
    await tx
      .update(schema.invitation)
      .set({ revokedAt: new Date() })
      .where(and(eq(schema.invitation.workerId, workerId), isNull(schema.invitation.acceptedAt), isNull(schema.invitation.revokedAt)));
    const [row] = await tx
      .insert(schema.invitation)
      .values({
        organisationId,
        workerId,
        tokenHash: hashInviteToken(token),
        expiresAt: new Date(Date.now() + INVITE_DAYS * 86_400_000),
        createdByUserId: user.id,
      })
      .returning({ id: schema.invitation.id });
    await tx.insert(schema.auditEvent).values({
      organisationId,
      actorUserId: user.id,
      requestId: await requestId(),
      action: "invite",
      entity: "worker",
      entityId: workerId,
      data: { invitationId: row!.id, byText: byText && !!linked?.mobile },
    });
    return { ok: `Send this link to ${worker.name}. It works once, for ${INVITE_DAYS} days.`, mobile: linked?.mobile };
  });
  if (result.error) return result;
  const origin = (await headers()).get("origin") ?? process.env.BETTER_AUTH_URL ?? "";
  const link = `${origin}/join/${token}`;
  if (!byText || !result.mobile) return { ok: result.ok, link };

  const body = inviteText({ business: businessName, link, days: INVITE_DAYS });
  // The link signs someone in, so the text log keeps a placeholder instead.
  const sent = await sendTexts(organisationId, "invite", [{ to: result.mobile, body, logBody: body.replace(link, appUrl("/join/<link>")) }]);
  const number = formatUkMobile(result.mobile);
  if (!smsConfigured()) return { link, ok: `Texts are not switched on yet, so nothing was sent to ${number}. Copy the link below and send it yourself.` };
  if (!sent) return { link, error: `The text to ${number} could not be sent. Copy the link below and send it another way.` };
  return { link, ok: `Link texted to ${number}. It works once, for ${INVITE_DAYS} days. You can also copy it below.` };
}

/** Saves or clears the person's mobile number, used to text them their invitation. */
export async function setMobile(_: FormState, form: FormData): Promise<FormState> {
  const { user, organisationId } = await requireManager();
  const workerId = String(form.get("workerId") ?? "");
  const raw = String(form.get("mobile") ?? "").trim();
  const mobile = raw ? normaliseUkMobile(raw) : null;
  if (raw && !mobile) return { error: "Enter a UK mobile number, for example 07700 900123.", values: { mobile: raw } };
  const result = await withOrganisation(db, organisationId, async (tx): Promise<FormState> => {
    const worker = await findWorker(tx, workerId);
    if (!worker) return { error: "That person could not be found." };
    await tx.update(schema.worker).set({ mobile }).where(eq(schema.worker.id, workerId));
    await tx.insert(schema.auditEvent).values({
      organisationId,
      actorUserId: user.id,
      requestId: await requestId(),
      action: mobile ? "set_mobile" : "clear_mobile",
      entity: "worker",
      entityId: workerId,
    });
    return { ok: mobile ? `Mobile number saved for ${worker.name}.` : `Mobile number removed for ${worker.name}.` };
  });
  revalidatePath(`/staff/${workerId}`);
  return result;
}

export async function addStaffUnavailable(_: FormState, form: FormData): Promise<FormState> {
  const { user, organisationId } = await requireManager();
  const workerId = String(form.get("workerId") ?? "");
  const slot = parseSlot(form);
  if ("error" in slot) return { error: slot.error, values: Object.fromEntries([...form.entries()].map(([k, v]) => [k, String(v)])) };
  const result = await withOrganisation(db, organisationId, async (tx): Promise<FormState> => {
    const worker = await findWorker(tx, workerId);
    if (!worker) return { error: "That person could not be found." };
    await addUnavailable(tx, { organisationId, workerId, actorUserId: user.id, requestId: await requestId(), slot });
    return { ok: `Added for ${worker.name}.` };
  });
  revalidatePath(`/staff/${workerId}`);
  return result;
}

export async function removeStaffUnavailable(form: FormData) {
  const { user, organisationId } = await requireManager();
  const workerId = String(form.get("workerId") ?? "");
  const id = String(form.get("id") ?? "");
  await withOrganisation(db, organisationId, async (tx) =>
    removeUnavailable(tx, { organisationId, workerId, actorUserId: user.id, requestId: await requestId(), id }),
  );
  revalidatePath(`/staff/${workerId}`);
}

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Adjustments agreed with the person. Checked on every rota; the note is never shown on the rota. */
export async function saveAdjustments(_: FormState, form: FormData): Promise<FormState> {
  const { user, organisationId } = await requireManager();
  const workerId = String(form.get("workerId") ?? "");
  const values = Object.fromEntries([...form.entries()].map(([k, v]) => [k, String(v)]));
  const max = values.maxShiftHours?.trim() ? Number(values.maxShiftHours) : undefined;
  const earliestStart = values.earliestStart || undefined;
  const latestFinish = values.latestFinish || undefined;
  const note = values.note?.trim().slice(0, 1000) || undefined;
  if (max !== undefined && !(max >= 1 && max <= 24)) return { error: "Enter a longest shift between 1 and 24 hours, or leave it empty.", values };
  if ((earliestStart && !TIME.test(earliestStart)) || (latestFinish && !TIME.test(latestFinish))) return { error: "Enter times like 09:00.", values };
  if (earliestStart && latestFinish && latestFinish <= earliestStart) return { error: "The finish time must be after the start time.", values };
  const adjustments = { maxShiftHours: max, earliestStart, latestFinish, note };
  const result = await withOrganisation(db, organisationId, async (tx): Promise<FormState> => {
    const worker = await findWorker(tx, workerId);
    if (!worker) return { error: "That person could not be found." };
    await tx.update(schema.worker).set({ adjustments: JSON.parse(JSON.stringify(adjustments)) }).where(eq(schema.worker.id, workerId));
    await tx.insert(schema.auditEvent).values({
      organisationId,
      actorUserId: user.id,
      requestId: await requestId(),
      action: "set_adjustments",
      entity: "worker",
      entityId: workerId,
      // The note can describe health, so the audit trail only records that one exists.
      data: { maxShiftHours: max ?? null, earliestStart: earliestStart ?? null, latestFinish: latestFinish ?? null, hasNote: !!note },
    });
    return { ok: `Adjustments saved for ${worker.name}. Every rota is now checked against them.` };
  });
  revalidatePath(`/staff/${workerId}`);
  return result;
}

/**
 * Marks someone as having left. Their records stay for payroll and working-time checks, but they are no
 * longer put on rotas or counted in the price. Shifts after their last day become open shifts.
 */
export async function markLeft(_: FormState, form: FormData): Promise<FormState> {
  const { user, organisationId } = await requireManager();
  const workerId = String(form.get("workerId") ?? "");
  const leftOn = String(form.get("leftOn") ?? "");
  if (!DATE.test(leftOn)) return { error: "Enter their last day." };
  const freed = await withOrganisation(db, organisationId, async (tx) => {
    const worker = await findWorker(tx, workerId);
    if (!worker) return null;
    await tx.update(schema.worker).set({ leftOn }).where(eq(schema.worker.id, workerId));
    const after = new Date(londonDateTime(addDays(leftOn, 1), "00:00"));
    const shifts = await tx
      .update(schema.shift)
      .set({ workerId: null })
      .where(and(eq(schema.shift.workerId, workerId), gte(schema.shift.startsAt, after)))
      .returning({ id: schema.shift.id });
    await tx.insert(schema.auditEvent).values({
      organisationId,
      actorUserId: user.id,
      requestId: await requestId(),
      action: "update",
      entity: "worker",
      entityId: workerId,
      data: { leftOn, shiftsOpened: shifts.length },
    });
    return shifts.length;
  });
  if (freed === null) return { error: "This person could not be found." };
  revalidatePath("/staff", "layout");
  revalidatePath("/rota");
  return { ok: freed ? `Saved. ${freed} shift${freed === 1 ? "" : "s"} after their last day ${freed === 1 ? "is" : "are"} now open on the rota.` : "Saved." };
}

/** Undoes markLeft, for someone who comes back or was marked by mistake. */
export async function markBack(_: FormState, form: FormData): Promise<FormState> {
  const { user, organisationId } = await requireManager();
  const workerId = String(form.get("workerId") ?? "");
  const full = await addingBlocked(organisationId);
  if (full) return { error: full };
  const found = await withOrganisation(db, organisationId, async (tx) => {
    const worker = await findWorker(tx, workerId);
    if (!worker) return false;
    await tx.update(schema.worker).set({ leftOn: null }).where(eq(schema.worker.id, workerId));
    await tx.insert(schema.auditEvent).values({
      organisationId,
      actorUserId: user.id,
      requestId: await requestId(),
      action: "update",
      entity: "worker",
      entityId: workerId,
      data: { leftOn: null },
    });
    return true;
  });
  if (!found) return { error: "This person could not be found." };
  revalidatePath("/staff", "layout");
  return { ok: "Saved. They are back on the team." };
}
