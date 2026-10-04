"use server";

import type { LeaveKind } from "@vicisrota/compliance";
import { schema, withOrganisation } from "@vicisrota/db";
import { and, eq, gt, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/business";
import { checkAssignment } from "@/lib/claims";
import { recordClock } from "@/lib/clock";
import { hashPin, pinProblem } from "@/lib/pin";
import { db } from "@/lib/db";
import { helpAlert, normaliseUkMobile } from "@vicisrota/messaging";
import { LEAVE_KINDS, LEAVE_LABEL } from "@/lib/leave";
import { log } from "@/lib/log";
import { requestId } from "@/lib/request";
import { appUrl, textAlertContacts } from "@/lib/sms";
import { todayInUk } from "@/lib/rota";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** values: what was typed, sent back on an error so the form is not cleared. */
export type FormState = { error?: string; ok?: string; values?: Record<string, string> };

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

const ukTime = (d: Date) => new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(d);

/** A lone working check-in on the person's own shift: started, OK, finished safely, or a call for help. */
export async function loneCheckIn(_: FormState, form: FormData): Promise<FormState> {
  const { user, organisationId, businessName, worker } = await requireStaff();
  const shiftId = String(form.get("shiftId") ?? "");
  const kind = String(form.get("kind") ?? "") as (typeof LONE_KINDS)[number];
  const note = String(form.get("note") ?? "").trim().slice(0, 1000) || null;
  if (!LONE_KINDS.includes(kind)) return { error: "Something went wrong. Please try again." };
  let helpCheck: { id: string; at: Date } | undefined;
  const result = await withOrganisation(db, organisationId, async (tx): Promise<FormState> => {
    const [shift] = await tx
      .select({ id: schema.shift.id })
      .from(schema.shift)
      .where(and(eq(schema.shift.id, shiftId), eq(schema.shift.workerId, worker.id), eq(schema.shift.loneWorking, true), eq(schema.shift.status, "published")));
    if (!shift) return { error: "That shift could not be found." };
    const [check] = await tx
      .insert(schema.loneWorkCheck)
      .values({ organisationId, shiftId, actorUserId: user.id, actorName: worker.fullName, kind, note })
      .returning({ id: schema.loneWorkCheck.id, at: schema.loneWorkCheck.createdAt });
    helpCheck = check;
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
  if (kind === "help" && helpCheck) {
    await log("warn", "lone worker asked for help", { organisationId, shiftId });
    // Text the people on the alert list straight away.
    const [where] = await withOrganisation(db, organisationId, (tx) =>
      tx
        .select({ client: schema.client.name, postcode: schema.client.postcode })
        .from(schema.shift)
        .leftJoin(schema.client, eq(schema.shift.clientId, schema.client.id))
        .where(eq(schema.shift.id, shiftId)),
    );
    await textAlertContacts(
      organisationId,
      "lone_help",
      helpAlert({
        business: businessName,
        person: worker.fullName,
        at: ukTime(helpCheck.at),
        where: [where?.client, where?.postcode].filter(Boolean).join(", ") || null,
        note,
        link: appUrl("/lone-working"),
      }),
      `help:${helpCheck.id}`,
    );
  }
  revalidatePath("/me");
  return result;
}

/** "Got it": the person has read their rota changes. */
export async function markNoticesSeen() {
  const { organisationId, worker } = await requireStaff();
  await withOrganisation(db, organisationId, (tx) =>
    tx
      .update(schema.rotaNotice)
      .set({ seenAt: new Date() })
      .where(and(eq(schema.rotaNotice.workerId, worker.id), isNull(schema.rotaNotice.seenAt))),
  );
  revalidatePath("/me");
}

export async function savePreferences(form: FormData) {
  const { organisationId, worker } = await requireStaff();
  // Keep the text setting, which is saved by its own form.
  const preferences = { ...worker.preferences, calm: form.get("calm") === "on", largeText: form.get("largeText") === "on" };
  await withOrganisation(db, organisationId, (tx) => tx.update(schema.worker).set({ preferences }).where(eq(schema.worker.id, worker.id)));
  revalidatePath("/me");
}

const CLOCK_KINDS = ["in", "break_start", "break_end", "out"] as const;

/** Clock in, start or end a break, or clock out, on one of the person's own shifts happening now. */
export async function clock(_: FormState, form: FormData): Promise<FormState> {
  const { user, organisationId, worker } = await requireStaff();
  const shiftId = String(form.get("shiftId") ?? "");
  const kind = String(form.get("kind") ?? "") as (typeof CLOCK_KINDS)[number];
  if (!CLOCK_KINDS.includes(kind)) return { error: "Something went wrong. Please try again." };
  const latitude = Number(form.get("latitude"));
  const longitude = Number(form.get("longitude"));
  const accuracyMetres = Number(form.get("accuracy"));
  const position =
    form.get("latitude") && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180 && Number.isFinite(accuracyMetres)
      ? { latitude, longitude, accuracyMetres }
      : null;
  const reference = await requestId();
  const result = await withOrganisation(db, organisationId, (tx) =>
    recordClock(tx, { organisationId, workerId: worker.id, actorUserId: user.id, shiftId, kind, requestId: reference, source: "phone", position }),
  );
  revalidatePath("/me");
  return result;
}

/** Sets the PIN used on the in-store clock-in tablet. Only a hash is stored. */
export async function setClockPin(_: FormState, form: FormData): Promise<FormState> {
  const { user, organisationId, worker } = await requireStaff();
  const pin = String(form.get("pin") ?? "");
  if (pin !== String(form.get("confirm") ?? "")) return { error: "The two PINs do not match." };
  const problem = pinProblem(pin);
  if (problem) return { error: problem };
  const pinHash = await hashPin(pin);
  await withOrganisation(db, organisationId, async (tx) => {
    await tx.update(schema.worker).set({ pinHash, pinFailures: 0, pinLockedUntil: null }).where(eq(schema.worker.id, worker.id));
    await tx.insert(schema.auditEvent).values({ organisationId, actorUserId: user.id, requestId: await requestId(), action: "set_pin", entity: "worker", entityId: worker.id });
  });
  revalidatePath("/me");
  return { ok: "PIN saved. Use it on the clock-in tablet at work." };
}

/** The person's own mobile number, and whether they want a text when their rota changes. */
export async function saveTextSettings(_: FormState, form: FormData): Promise<FormState> {
  const { user, organisationId, worker } = await requireStaff();
  const raw = String(form.get("mobile") ?? "").trim();
  const mobile = raw ? normaliseUkMobile(raw) : null;
  const textChanges = form.get("textChanges") === "on";
  const values = { mobile: raw, textChanges: textChanges ? "on" : "" };
  if (raw && !mobile) return { error: "Enter a UK mobile number, for example 07700 900123.", values };
  if (textChanges && !mobile) return { error: "Add your mobile number to get texts.", values };
  await withOrganisation(db, organisationId, async (tx) => {
    await tx.update(schema.worker).set({ mobile, preferences: { ...worker.preferences, textChanges } }).where(eq(schema.worker.id, worker.id));
    await tx.insert(schema.auditEvent).values({
      organisationId,
      actorUserId: user.id,
      requestId: await requestId(),
      action: "text_settings",
      entity: "worker",
      entityId: worker.id,
      data: { textChanges, hasMobile: !!mobile },
    });
  });
  revalidatePath("/me");
  return { ok: textChanges ? "Saved. We will text you when your rota changes." : "Saved. You will not get texts about your rota." };
}
