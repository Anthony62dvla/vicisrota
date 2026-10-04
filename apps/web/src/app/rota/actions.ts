"use server";

import { addDays, evaluate, londonDateTime, londonParts, type Finding } from "@vicisrota/compliance";
import { schema, withOrganisation } from "@vicisrota/db";
import { and, eq, gte, inArray, lt, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireManager } from "@/lib/business";
import { db } from "@/lib/db";
import { log } from "@/lib/log";
import { notify, type Notice } from "@/lib/notices";
import { textRotaChanges } from "@/lib/rota-texts";
import { requestId } from "@/lib/request";
import { checkAssignment } from "@/lib/claims";
import { loadComplianceContext, weekBounds } from "@/lib/rota";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^\d{2}:\d{2}$/;
const MINUTE = 60_000;

export type FormState = { error?: string; ok?: string };

export async function addShift(_: FormState, form: FormData): Promise<FormState> {
  const { user, organisationId } = await requireManager();
  // Empty means an open shift that staff can ask to pick up.
  const workerId = String(form.get("workerId") ?? "") || null;
  const date = String(form.get("date") ?? "");
  const start = String(form.get("start") ?? "");
  const end = String(form.get("end") ?? "");
  const breakMinutes = Number(form.get("breakMinutes") ?? 0);
  const requires = [...new Set(form.getAll("requires").map(String))];
  const clientId = String(form.get("clientId") ?? "") || null;
  const roleId = String(form.get("roleId") ?? "") || null;
  const travelMinutes = Number(form.get("travelMinutes") ?? 0);
  const note = String(form.get("note") ?? "").trim() || null;
  if (note && note.length > 500) return { error: "Keep the note for the person under 500 characters." };
  if (!DATE.test(date)) return { error: "Choose the day." };
  if (!TIME.test(start) || !TIME.test(end)) return { error: "Enter a start and finish time." };
  if (!(breakMinutes >= 0 && breakMinutes <= 240)) return { error: "Enter a break between 0 and 240 minutes." };
  const loneWorking = form.get("loneWorking") === "on";
  const checkInMinutes = Number(form.get("checkInMinutes") ?? 60);
  if (!(Number.isInteger(checkInMinutes) && checkInMinutes >= 15 && checkInMinutes <= 240)) return { error: "Choose how often they check in." };
  if (!(Number.isInteger(travelMinutes) && travelMinutes >= 0 && travelMinutes <= 240))
    return { error: "Enter travel time between 0 and 240 minutes." };

  const startsAt = londonDateTime(date, start);
  // A finish time at or before the start means the shift ends the next morning.
  let endsAt = londonDateTime(date, end);
  if (endsAt <= startsAt) endsAt = londonDateTime(addDays(date, 1), end);
  if (breakMinutes * MINUTE >= endsAt - startsAt) return { error: "The break is longer than the shift." };

  const error = await withOrganisation(db, organisationId, async (tx) => {
    // Foreign keys skip row-level security, so confirm the person and training belong to this business.
    if (workerId) {
      const [worker] = await tx.select({ id: schema.worker.id }).from(schema.worker).where(eq(schema.worker.id, workerId));
      if (!worker) return "That person could not be found.";
    }
    if (clientId) {
      const [found] = await tx.select({ id: schema.client.id }).from(schema.client).where(eq(schema.client.id, clientId));
      if (!found) return "That client could not be found.";
    }
    if (roleId) {
      const [found] = await tx.select({ id: schema.jobRole.id }).from(schema.jobRole).where(eq(schema.jobRole.id, roleId));
      if (!found) return "That job role could not be found.";
    }
    if (requires.length) {
      const known = await tx.select({ id: schema.qualification.id }).from(schema.qualification).where(inArray(schema.qualification.id, requires));
      if (known.length !== requires.length) return "Some of the training chosen could not be found.";
    }
    const [shift] = await tx
      .insert(schema.shift)
      .values({ organisationId, workerId, clientId, roleId, travelMinutes, loneWorking, checkInMinutes, note, startsAt: new Date(startsAt), endsAt: new Date(endsAt) })
      .returning({ id: schema.shift.id });
    if (breakMinutes > 0) {
      // Place the break in the middle of the shift; exact break times can be edited later.
      const breakStart = startsAt + Math.round((endsAt - startsAt - breakMinutes * MINUTE) / 2 / MINUTE) * MINUTE;
      await tx.insert(schema.shiftBreak).values({
        organisationId,
        shiftId: shift!.id,
        startsAt: new Date(breakStart),
        endsAt: new Date(breakStart + breakMinutes * MINUTE),
      });
    }
    if (requires.length) {
      await tx.insert(schema.shiftRequirement).values(requires.map((qualificationId) => ({ organisationId, shiftId: shift!.id, qualificationId })));
    }
    await tx.insert(schema.auditEvent).values({
      organisationId,
      actorUserId: user.id,
      requestId: await requestId(),
      action: "create",
      entity: "shift",
      entityId: shift!.id,
      data: { workerId, date, start, end, breakMinutes, requires, clientId, roleId, travelMinutes, loneWorking, checkInMinutes, note: !!note },
    });
  });
  if (error) return { error };
  revalidatePath("/rota");
  return { ok: `${clientId ? "Visit" : workerId ? "Shift" : "Open shift"} added as a draft.` };
}

export async function cancelShift(form: FormData) {
  const { user, organisationId, businessName } = await requireManager();
  const shiftId = String(form.get("shiftId") ?? "");
  const notices = await withOrganisation(db, organisationId, async (tx) => {
    const [cancelled] = await tx
      .update(schema.shift)
      .set({ status: "cancelled" })
      .where(eq(schema.shift.id, shiftId))
      .returning({ workerId: schema.shift.workerId, startsAt: schema.shift.startsAt, endsAt: schema.shift.endsAt, publishedAt: schema.shift.publishedAt });
    // Staff only knew about it if it had been published.
    const notices = cancelled?.publishedAt ? await notify(tx, organisationId, [{ ...cancelled, shiftId, kind: "cancelled" }]) : [];
    await tx.insert(schema.auditEvent).values({
      organisationId,
      actorUserId: user.id,
      requestId: await requestId(),
      action: "cancel",
      entity: "shift",
      entityId: shiftId,
    });
    return notices;
  });
  await textRotaChanges(organisationId, businessName, notices);
  revalidatePath("/rota");
}

export async function checkAndPublish(_: FormState, form: FormData): Promise<FormState> {
  const { user, organisationId, businessName } = await requireManager();
  const weekStart = String(form.get("weekStart") ?? "");
  if (!DATE.test(weekStart)) return { error: "Choose a week." };
  const reference = await requestId();
  const { from, to } = weekBounds(weekStart);

  const result = await withOrganisation(db, organisationId, async (tx) => {
    const context = await loadComplianceContext(tx, organisationId, weekStart);
    const evaluation = evaluate(context);
    // Only findings touching this week's shifts decide whether this week can be published.
    const thisWeek = new Set(
      context.shifts.filter((s) => Date.parse(s.start) >= from.getTime() && Date.parse(s.start) < to.getTime()).map((s) => s.id),
    );
    const findings: Finding[] = evaluation.findings.filter((f) => f.shiftIds.some((id) => thisWeek.has(id)));
    const publishable = !findings.some((f) => f.severity === "block");

    await tx.insert(schema.complianceDecision).values({
      organisationId,
      asOf: context.asOf,
      rulesApplied: evaluation.rulesApplied,
      findings,
      publishable,
      requestId: reference,
      actorUserId: user.id,
    });

    let published = 0;
    let notices: Notice[] = [];
    if (publishable) {
      const rows = await tx
        .update(schema.shift)
        .set({ status: "published", publishedAt: new Date() })
        .where(and(eq(schema.shift.status, "draft"), gte(schema.shift.startsAt, from), lt(schema.shift.startsAt, to)))
        .returning({ id: schema.shift.id, workerId: schema.shift.workerId, startsAt: schema.shift.startsAt, endsAt: schema.shift.endsAt });
      published = rows.length;
      notices = await notify(tx, organisationId, rows.map((r) => ({ ...r, shiftId: r.id, kind: "added" as const })));
      await tx.insert(schema.auditEvent).values({
        organisationId,
        actorUserId: user.id,
        requestId: reference,
        action: "publish",
        entity: "rota",
        entityId: weekStart,
        data: { shiftIds: rows.map((r) => r.id) },
      });
    }
    return { publishable, blocking: findings.filter((f) => f.severity === "block").length, published, notices };
  });

  const { notices, ...summary } = result;
  await log("info", "rota checked", { organisationId, weekStart, ...summary });
  await textRotaChanges(organisationId, businessName, notices);
  revalidatePath("/rota");
  if (!result.publishable)
    return { error: `This rota cannot be published yet: ${result.blocking} problem${result.blocking === 1 ? "" : "s"} to fix. See the list below.` };
  return { ok: result.published ? `Rota published: ${result.published} shift${result.published === 1 ? "" : "s"} now published.` : "Rota checked. There were no new draft shifts to publish." };
}

/** Approves or declines a request to pick up a shift. Approving re-runs the checks first. */
export async function decideClaim(_: FormState, form: FormData): Promise<FormState> {
  const { user, organisationId, businessName } = await requireManager();
  const claimId = String(form.get("claimId") ?? "");
  const approve = form.get("decision") === "approve";

  const result = await withOrganisation(db, organisationId, async (tx): Promise<FormState & { notices?: Notice[] }> => {
    const [claim] = await tx
      .select({ claim: schema.shiftClaim, name: schema.worker.fullName })
      .from(schema.shiftClaim)
      .innerJoin(schema.worker, eq(schema.shiftClaim.workerId, schema.worker.id))
      .where(and(eq(schema.shiftClaim.id, claimId), eq(schema.shiftClaim.status, "requested")));
    if (!claim) return { error: "That request has already been dealt with." };
    const { shiftId, workerId } = claim.claim;
    const audit = async (action: string, data: Record<string, unknown>) =>
      tx.insert(schema.auditEvent).values({
        organisationId,
        actorUserId: user.id,
        requestId: await requestId(),
        action,
        entity: "shift_claim",
        entityId: claimId,
        data: { shiftId, workerId, ...data },
      });

    if (!approve) {
      await tx.update(schema.shiftClaim).set({ status: "declined", decidedByUserId: user.id, decidedAt: new Date() }).where(eq(schema.shiftClaim.id, claimId));
      await audit("decline", {});
      return { ok: `Request from ${claim.name} declined.` };
    }
    // The rota may have changed since the request was made, so check again.
    const check = await checkAssignment(tx, organisationId, shiftId, workerId);
    if (!check || check.shift.status === "cancelled") return { error: "That shift no longer exists." };
    if (check.blocks.length) return { error: `${claim.name} cannot take this shift now: ${check.blocks.map((f) => f.message).join(" ")}` };
    const previous = check.shift.workerId;
    await tx.update(schema.shift).set({ workerId, coverRequestedAt: null }).where(eq(schema.shift.id, shiftId));
    await tx.update(schema.shiftClaim).set({ status: "approved", decidedByUserId: user.id, decidedAt: new Date() }).where(eq(schema.shiftClaim.id, claimId));
    // Anyone else who asked for the same shift is told it has gone.
    await tx
      .update(schema.shiftClaim)
      .set({ status: "declined", decidedByUserId: user.id, decidedAt: new Date() })
      .where(and(eq(schema.shiftClaim.shiftId, shiftId), eq(schema.shiftClaim.status, "requested")));
    const times = { shiftId, startsAt: check.shift.startsAt, endsAt: check.shift.endsAt };
    const notices = await notify(tx, organisationId, [
      { ...times, workerId, kind: "given_to_you" },
      { ...times, workerId: previous, kind: "taken_by_colleague" },
    ]);
    await audit("approve", { previousWorkerId: previous });
    return { ok: `${claim.name} now has this shift.`, notices };
  });
  const { notices = [], ...state } = result;
  await textRotaChanges(organisationId, businessName, notices);
  revalidatePath("/rota");
  return state;
}

/** The same UK wall-clock time a week later, so a copied shift keeps its times across a clock change. */
const aWeekLater = (d: Date) => {
  const p = londonParts(d.getTime());
  return new Date(londonDateTime(addDays(p.date, 7), `${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}`));
};

/**
 * Copies last week's shifts into this week as drafts, with their roles, breaks, training needs, visits and
 * lone working settings. A shift already in this week for the same person at the same time is skipped,
 * so pressing it twice does nothing more. Nobody sees the copies until the week is checked and published.
 */
export async function copyPreviousWeek(_: FormState, form: FormData): Promise<FormState> {
  const { user, organisationId } = await requireManager();
  const weekStart = String(form.get("weekStart") ?? "");
  if (!DATE.test(weekStart)) return { error: "Choose a week." };
  const { from, to } = weekBounds(weekStart);
  const previous = weekBounds(addDays(weekStart, -7));

  const result = await withOrganisation(db, organisationId, async (tx) => {
    const source = await tx
      .select()
      .from(schema.shift)
      .where(and(gte(schema.shift.startsAt, previous.from), lt(schema.shift.startsAt, previous.to), ne(schema.shift.status, "cancelled")));
    if (!source.length) return { copied: 0, skipped: 0 };
    const existing = await tx
      .select({ workerId: schema.shift.workerId, startsAt: schema.shift.startsAt, endsAt: schema.shift.endsAt })
      .from(schema.shift)
      .where(and(gte(schema.shift.startsAt, from), lt(schema.shift.startsAt, to), ne(schema.shift.status, "cancelled")));
    const taken = new Set(existing.map((e) => `${e.workerId}|${e.startsAt.getTime()}|${e.endsAt.getTime()}`));
    const ids = source.map((s) => s.id);
    const [breaks, requirements] = await Promise.all([
      tx.select().from(schema.shiftBreak).where(inArray(schema.shiftBreak.shiftId, ids)),
      tx.select().from(schema.shiftRequirement).where(inArray(schema.shiftRequirement.shiftId, ids)),
    ]);
    let copied = 0;
    for (const s of source) {
      const startsAt = aWeekLater(s.startsAt);
      const endsAt = aWeekLater(s.endsAt);
      if (taken.has(`${s.workerId}|${startsAt.getTime()}|${endsAt.getTime()}`)) continue;
      const [row] = await tx
        .insert(schema.shift)
        .values({
          organisationId,
          workerId: s.workerId,
          locationId: s.locationId,
          clientId: s.clientId,
          roleId: s.roleId,
          note: s.note,
          travelMinutes: s.travelMinutes,
          loneWorking: s.loneWorking,
          checkInMinutes: s.checkInMinutes,
          startsAt,
          endsAt,
        })
        .returning({ id: schema.shift.id });
      const myBreaks = breaks.filter((b) => b.shiftId === s.id);
      if (myBreaks.length)
        await tx.insert(schema.shiftBreak).values(myBreaks.map((b) => ({ organisationId, shiftId: row!.id, startsAt: aWeekLater(b.startsAt), endsAt: aWeekLater(b.endsAt) })));
      const needs = requirements.filter((r) => r.shiftId === s.id);
      if (needs.length) await tx.insert(schema.shiftRequirement).values(needs.map((r) => ({ organisationId, shiftId: row!.id, qualificationId: r.qualificationId })));
      copied++;
    }
    await tx.insert(schema.auditEvent).values({
      organisationId,
      actorUserId: user.id,
      requestId: await requestId(),
      action: "copy_week",
      entity: "rota",
      entityId: weekStart,
      data: { from: addDays(weekStart, -7), copied, skipped: source.length - copied },
    });
    return { copied, skipped: source.length - copied };
  });
  revalidatePath("/rota");
  if (!result.copied && !result.skipped) return { error: "Last week has no shifts to copy." };
  if (!result.copied) return { ok: "Every shift from last week is already in this week. Nothing was copied." };
  return {
    ok: `${result.copied} shift${result.copied === 1 ? "" : "s"} copied as drafts${result.skipped ? ` (${result.skipped} already here)` : ""}. Check them, then publish.`,
  };
}
