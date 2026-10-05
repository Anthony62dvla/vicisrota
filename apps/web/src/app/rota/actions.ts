"use server";

import { randomUUID } from "node:crypto";
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
import { owedMessage, recordShortNotice } from "@/lib/short-notice";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^\d{2}:\d{2}$/;
const MINUTE = 60_000;

export type FormState = { error?: string; ok?: string };

type Shift = typeof schema.shift.$inferSelect;
type Tx = Parameters<Parameters<typeof withOrganisation>[2]>[0];

/** Thrown inside a transaction to undo a change that would break the law on a published rota. */
class Refused extends Error {}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/**
 * Runs after a shift is added, edited or moved, inside the same transaction. A published shift must stay
 * legal, so a change that breaks a rule is undone. A draft is saved either way, and the reply says what
 * to fix before publishing, so problems show while the rota is being built rather than at the end.
 * People on a published shift are told when it changes.
 */
const afterChange = async (tx: Tx, organisationId: string, before: Shift | null, after: Shift) => {
  const check = after.workerId ? await checkAssignment(tx, organisationId, after.id, after.workerId) : null;
  const blocks = check?.blocks ?? [];
  const warnings = check?.warnings ?? [];
  if (after.status === "published" && blocks.length) throw new Refused(`This shift is published, so the change was not saved: ${blocks.map((f) => f.message).join(" ")}`);

  let notices: Notice[] = [];
  if (after.status === "published" && before) {
    const times = { shiftId: after.id, startsAt: after.startsAt, endsAt: after.endsAt };
    if (before.workerId !== after.workerId) {
      notices = await notify(tx, organisationId, [
        { ...times, workerId: after.workerId, kind: "added" },
        { ...times, workerId: before.workerId, kind: after.workerId ? "taken_by_colleague" : "cancelled" },
      ]);
    } else if (before.startsAt.getTime() !== after.startsAt.getTime() || before.endsAt.getTime() !== after.endsAt.getTime()) {
      notices = await notify(tx, organisationId, [{ ...times, workerId: after.workerId, kind: "changed" }]);
    }
  }
  // The person who had a published shift is paid for time they lose at short notice.
  const owed = before && after.status === "published" ? await recordShortNotice(tx, organisationId, before, before.workerId === after.workerId ? after : null) : null;
  if (after.workerId && before?.workerId !== after.workerId) {
    // Anyone who asked to pick this shift up is told it has gone.
    await tx
      .update(schema.shiftClaim)
      .set({ status: "declined", decidedAt: new Date() })
      .where(and(eq(schema.shiftClaim.shiftId, after.id), eq(schema.shiftClaim.status, "requested")));
  }
  const problems = [...blocks.map((f) => `Must fix: ${f.message}`), ...warnings.map((f) => `Check: ${f.message}`)];
  return { notices, problems, checked: !!check, published: after.status === "published", owed: owed ? [owedMessage(owed)] : [] };
};

const savedMessage = (what: string, change: { problems: string[]; checked: boolean; published: boolean; owed?: string[] }) =>
  [problemsMessage(what, change), ...(change.owed ?? [])].join(" ");

const problemsMessage = (what: string, change: { problems: string[]; checked: boolean; published: boolean }) =>
  change.problems.length
    ? `${what} ${plural(change.problems.length, "thing")} to look at${change.published ? "" : " before publishing"}: ${change.problems.join(" ")}`
    : change.checked
      ? `${what} No problems found.`
      : what;

/** A split shift with only one part left is just a shift. Runs inside the transaction. */
const tidySplit = async (tx: Tx, groupId: string | null) => {
  if (!groupId) return;
  const parts = await tx
    .select({ id: schema.shift.id })
    .from(schema.shift)
    .where(and(eq(schema.shift.splitGroupId, groupId), ne(schema.shift.status, "cancelled")));
  if (parts.length < 2) await tx.update(schema.shift).set({ splitGroupId: null }).where(eq(schema.shift.splitGroupId, groupId));
};

/** Adds a shift (or a split shift in two parts), or edits one shift or part when the form has a shiftId. */
export async function saveShift(_: FormState, form: FormData): Promise<FormState> {
  const { user, organisationId, businessName } = await requireManager();
  const shiftId = String(form.get("shiftId") ?? "") || null;
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

  // A split shift's second part starts after the first finishes, later the same day or that night.
  let second: { startsAt: number; endsAt: number } | null = null;
  if (!shiftId && form.get("split") === "on") {
    const start2 = String(form.get("start2") ?? "");
    const end2 = String(form.get("end2") ?? "");
    if (!TIME.test(start2) || !TIME.test(end2)) return { error: "Enter a start and finish time for the second part." };
    const firstEnd = londonParts(endsAt).date;
    let from = londonDateTime(firstEnd, start2);
    if (from <= endsAt) from = londonDateTime(addDays(firstEnd, 1), start2);
    if (from - endsAt >= 16 * 3_600_000) return { error: "The second part must start after the first part finishes, on the same day." };
    let to = londonDateTime(londonParts(from).date, end2);
    if (to <= from) to = londonDateTime(addDays(londonParts(from).date, 1), end2);
    second = { startsAt: from, endsAt: to };
  }

  let result: FormState & { notices?: Notice[] };
  try {
    result = await withOrganisation(db, organisationId, async (tx): Promise<FormState & { notices?: Notice[] }> => {
      // Foreign keys skip row-level security, so confirm the person and training belong to this business.
      if (workerId) {
        const [worker] = await tx.select({ id: schema.worker.id }).from(schema.worker).where(eq(schema.worker.id, workerId));
        if (!worker) return { error: "That person could not be found." };
      }
      if (clientId) {
        const [found] = await tx.select({ id: schema.client.id }).from(schema.client).where(eq(schema.client.id, clientId));
        if (!found) return { error: "That client could not be found." };
      }
      if (roleId) {
        const [found] = await tx.select({ id: schema.jobRole.id }).from(schema.jobRole).where(eq(schema.jobRole.id, roleId));
        if (!found) return { error: "That job role could not be found." };
      }
      if (requires.length) {
        const known = await tx.select({ id: schema.qualification.id }).from(schema.qualification).where(inArray(schema.qualification.id, requires));
        if (known.length !== requires.length) return { error: "Some of the training chosen could not be found." };
      }
      const splitGroupId = second ? randomUUID() : undefined;
      const values = { workerId, clientId, roleId, travelMinutes, loneWorking, checkInMinutes, note, startsAt: new Date(startsAt), endsAt: new Date(endsAt), splitGroupId };
      let before: Shift | null = null;
      let after: Shift;
      if (shiftId) {
        [before = null] = await tx.select().from(schema.shift).where(and(eq(schema.shift.id, shiftId), ne(schema.shift.status, "cancelled")));
        if (!before) return { error: "That shift no longer exists. It may have been cancelled." };
        [after] = (await tx.update(schema.shift).set(values).where(eq(schema.shift.id, shiftId)).returning()) as [Shift];
        await tx.delete(schema.shiftBreak).where(eq(schema.shiftBreak.shiftId, shiftId));
        await tx.delete(schema.shiftRequirement).where(eq(schema.shiftRequirement.shiftId, shiftId));
        // A part given to someone else is no longer part of the split.
        if (before.splitGroupId && before.workerId !== workerId) {
          await tx.update(schema.shift).set({ splitGroupId: null }).where(eq(schema.shift.id, shiftId));
          await tidySplit(tx, before.splitGroupId);
        }
      } else {
        [after] = (await tx.insert(schema.shift).values({ organisationId, ...values }).returning()) as [Shift];
      }
      if (breakMinutes > 0) {
        // Place the break in the middle of the shift.
        const breakStart = startsAt + Math.round((endsAt - startsAt - breakMinutes * MINUTE) / 2 / MINUTE) * MINUTE;
        await tx.insert(schema.shiftBreak).values({
          organisationId,
          shiftId: after.id,
          startsAt: new Date(breakStart),
          endsAt: new Date(breakStart + breakMinutes * MINUTE),
        });
      }
      if (requires.length) {
        await tx.insert(schema.shiftRequirement).values(requires.map((qualificationId) => ({ organisationId, shiftId: after.id, qualificationId })));
      }
      const changes = [await afterChange(tx, organisationId, before, after)];
      if (second) {
        const [part] = (await tx
          .insert(schema.shift)
          .values({ organisationId, ...values, startsAt: new Date(second.startsAt), endsAt: new Date(second.endsAt) })
          .returning()) as [Shift];
        if (requires.length) {
          await tx.insert(schema.shiftRequirement).values(requires.map((qualificationId) => ({ organisationId, shiftId: part.id, qualificationId })));
        }
        changes.push(await afterChange(tx, organisationId, null, part));
      }
      const change = {
        notices: changes.flatMap((c) => c.notices),
        problems: [...new Set(changes.flatMap((c) => c.problems))],
        checked: changes[0]!.checked,
        published: changes[0]!.published,
        owed: changes.flatMap((c) => c.owed),
      };
      await tx.insert(schema.auditEvent).values({
        organisationId,
        actorUserId: user.id,
        requestId: await requestId(),
        action: before ? "update" : "create",
        entity: "shift",
        entityId: after.id,
        data: {
          workerId, date, start, end, breakMinutes, requires, clientId, roleId, travelMinutes, loneWorking, checkInMinutes, note: !!note,
          ...(second && { splitGroupId, secondStart: new Date(second.startsAt).toISOString(), secondEnd: new Date(second.endsAt).toISOString() }),
        },
      });
      const what = before
        ? change.notices.length
          ? "Shift saved. The people affected have been told."
          : "Shift saved."
        : `${second ? "Split shift" : clientId ? "Visit" : workerId ? "Shift" : "Open shift"} added as a draft.`;
      return { ok: savedMessage(what, change), notices: change.notices };
    });
  } catch (error) {
    if (error instanceof Refused) return { error: error.message };
    throw error;
  }
  const { notices = [], ...state } = result;
  await textRotaChanges(organisationId, businessName, notices);
  revalidatePath("/rota");
  return state;
}

const wallClock = (d: Date) => {
  const p = londonParts(d.getTime());
  return `${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}`;
};

/**
 * Moves a shift to another person or day, keeping its times, length, breaks and everything else. An
 * empty workerId makes it an open shift. Used by dragging on the rota and by "Give this shift to".
 */
export async function moveShift(_: FormState, form: FormData): Promise<FormState> {
  const { user, organisationId, businessName } = await requireManager();
  const shiftId = String(form.get("shiftId") ?? "");
  const workerId = String(form.get("workerId") ?? "") || null;
  const date = String(form.get("date") ?? "");
  if (!DATE.test(date)) return { error: "Choose the day." };

  let result: FormState & { notices?: Notice[] };
  try {
    result = await withOrganisation(db, organisationId, async (tx): Promise<FormState & { notices?: Notice[] }> => {
      const [before] = await tx.select().from(schema.shift).where(and(eq(schema.shift.id, shiftId), ne(schema.shift.status, "cancelled")));
      if (!before) return { error: "That shift no longer exists. It may have been cancelled." };
      let name = "nobody yet";
      if (workerId) {
        const [worker] = await tx.select({ name: schema.worker.fullName }).from(schema.worker).where(eq(schema.worker.id, workerId));
        if (!worker) return { error: "That person could not be found." };
        name = worker.name;
      }
      const startsAt = new Date(londonDateTime(date, wallClock(before.startsAt)));
      const shiftBy = startsAt.getTime() - before.startsAt.getTime();
      if (before.workerId === workerId && shiftBy === 0) return { ok: "The shift is already there." };
      // Every part of a split shift moves together.
      const parts = before.splitGroupId
        ? await tx.select().from(schema.shift).where(and(eq(schema.shift.splitGroupId, before.splitGroupId), ne(schema.shift.status, "cancelled")))
        : [before];
      const changes = [];
      for (const part of parts) {
        const [after] = (await tx
          .update(schema.shift)
          .set({ workerId, startsAt: new Date(part.startsAt.getTime() + shiftBy), endsAt: new Date(part.endsAt.getTime() + shiftBy), coverRequestedAt: null })
          .where(eq(schema.shift.id, part.id))
          .returning()) as [Shift];
        if (shiftBy) {
          const breaks = await tx.select().from(schema.shiftBreak).where(eq(schema.shiftBreak.shiftId, part.id));
          for (const b of breaks)
            await tx
              .update(schema.shiftBreak)
              .set({ startsAt: new Date(b.startsAt.getTime() + shiftBy), endsAt: new Date(b.endsAt.getTime() + shiftBy) })
              .where(eq(schema.shiftBreak.id, b.id));
        }
        changes.push({ after, change: await afterChange(tx, organisationId, part, after) });
      }
      const change = {
        notices: changes.flatMap((c) => c.change.notices),
        problems: [...new Set(changes.flatMap((c) => c.change.problems))],
        checked: changes[0]!.change.checked,
        published: changes[0]!.change.published,
        owed: changes.flatMap((c) => c.change.owed),
      };
      await tx.insert(schema.auditEvent).values({
        organisationId,
        actorUserId: user.id,
        requestId: await requestId(),
        action: "move",
        entity: "shift",
        entityId: shiftId,
        data: { fromWorkerId: before.workerId, toWorkerId: workerId, fromStart: before.startsAt.toISOString(), toStart: startsAt.toISOString() },
      });
      const when = `${new Date(`${date}T12:00:00Z`).toLocaleDateString("en-GB", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" })}`;
      const what = `${parts.length > 1 ? "Split shift" : "Shift"} ${workerId ? `moved to ${name} on ${when}.` : `is now open, on ${when}.`}`;
      return { ok: savedMessage(what, change), notices: change.notices };
    });
  } catch (error) {
    if (error instanceof Refused) return { error: error.message };
    throw error;
  }
  const { notices = [], ...state } = result;
  await textRotaChanges(organisationId, businessName, notices);
  revalidatePath("/rota");
  return state;
}

/** Cancels a shift and says what happens next, including any short-notice pay owed. */
export async function cancelShift(form: FormData): Promise<string> {
  const { user, organisationId, businessName } = await requireManager();
  const shiftId = String(form.get("shiftId") ?? "");
  const { notices, owed } = await withOrganisation(db, organisationId, async (tx) => {
    const [cancelled] = await tx
      .update(schema.shift)
      .set({ status: "cancelled" })
      .where(and(eq(schema.shift.id, shiftId), ne(schema.shift.status, "cancelled")))
      .returning({ workerId: schema.shift.workerId, startsAt: schema.shift.startsAt, endsAt: schema.shift.endsAt, publishedAt: schema.shift.publishedAt, splitGroupId: schema.shift.splitGroupId });
    await tidySplit(tx, cancelled?.splitGroupId ?? null);
    const owed = cancelled ? await recordShortNotice(tx, organisationId, { ...cancelled, id: shiftId }, null) : null;
    // Staff only knew about it if it had been published.
    const notices = cancelled?.publishedAt
      ? await notify(tx, organisationId, [{ workerId: cancelled.workerId, startsAt: cancelled.startsAt, endsAt: cancelled.endsAt, shiftId, kind: "cancelled" }])
      : [];
    await tx.insert(schema.auditEvent).values({
      organisationId,
      actorUserId: user.id,
      requestId: await requestId(),
      action: "cancel",
      entity: "shift",
      entityId: shiftId,
    });
    return { notices, owed };
  });
  await textRotaChanges(organisationId, businessName, notices);
  revalidatePath("/rota");
  return ["Shift cancelled.", ...(owed ? [owedMessage(owed)] : [])].join(" ");
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
    // Copied split shifts get their own new group, so this week's parts stay together.
    const groups = new Map<string, string>();
    const groupFor = (id: string | null) => {
      if (!id) return null;
      if (!groups.has(id)) groups.set(id, randomUUID());
      return groups.get(id)!;
    };
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
          splitGroupId: groupFor(s.splitGroupId),
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
