"use server";

import { MAX_FILL_WEEKS, MAX_PATTERN_WEEKS, weekStart } from "@vicisrota/compliance";
import { schema, withOrganisation } from "@vicisrota/db";
import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireManager } from "@/lib/business";
import { db } from "@/lib/db";
import { fillFromPattern, savePattern } from "@/lib/patterns";
import { requestId } from "@/lib/request";
import { todayInUk } from "@/lib/rota";

export type FormState = { error?: string; ok?: string; values?: Record<string, string> };

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

export async function saveRotaPattern(_: FormState, form: FormData): Promise<FormState> {
  const { user, organisationId } = await requireManager();
  const name = String(form.get("name") ?? "").trim();
  const firstWeek = String(form.get("firstWeek") ?? "");
  const weeks = Number(form.get("weeks") ?? 1);
  const values = { name, firstWeek, weeks: String(weeks) };
  if (!name) return { error: "Give the pattern a name, for example Winter rota.", values };
  if (name.length > 80) return { error: "Keep the name under 80 characters.", values };
  if (!DATE.test(firstWeek)) return { error: "Choose the first week of the pattern.", values };
  if (!(Number.isInteger(weeks) && weeks >= 1 && weeks <= MAX_PATTERN_WEEKS)) return { error: "Choose how many weeks the pattern lasts.", values };
  const result = await withOrganisation(db, organisationId, async (tx) => {
    const [clash] = await tx.select({ id: schema.rotaPattern.id }).from(schema.rotaPattern).where(sql`lower(${schema.rotaPattern.name}) = lower(${name})`);
    if (clash) return "taken" as const;
    const saved = await savePattern(tx, { organisationId, userId: user.id, name, firstWeek: weekStart(firstWeek), weeks });
    if (!saved.shifts) {
      await tx.delete(schema.rotaPattern).where(eq(schema.rotaPattern.id, saved.patternId));
      return "empty" as const;
    }
    await tx.insert(schema.auditEvent).values({
      organisationId,
      actorUserId: user.id,
      requestId: await requestId(),
      action: "create",
      entity: "rota_pattern",
      entityId: saved.patternId,
      data: { name, firstWeek: weekStart(firstWeek), weeks, shifts: saved.shifts },
    });
    return saved;
  });
  if (result === "taken") return { error: `You already have a pattern called ${name}. Choose another name.`, values };
  if (result === "empty") return { error: "There are no shifts in those weeks to save. Add them to the rota first, as drafts if you like.", values };
  revalidatePath("/rota/patterns");
  return { ok: `${name} saved with ${plural(result.shifts, "shift")}.` };
}

export async function fillRotaFromPattern(_: FormState, form: FormData): Promise<FormState> {
  const { user, organisationId } = await requireManager();
  const patternId = String(form.get("patternId") ?? "");
  const fromWeek = String(form.get("fromWeek") ?? "");
  const weeks = Number(form.get("weeks") ?? 1);
  const startAtWeek = Number(form.get("startAtWeek") ?? 1) - 1;
  const values = { fromWeek, weeks: String(weeks), startAtWeek: String(startAtWeek + 1) };
  if (!DATE.test(fromWeek)) return { error: "Choose the first week to fill.", values };
  const monday = weekStart(fromWeek);
  if (monday < weekStart(todayInUk())) return { error: "Choose this week or a later one. Past weeks are not filled.", values };
  if (!(Number.isInteger(weeks) && weeks >= 1 && weeks <= MAX_FILL_WEEKS)) return { error: `Choose between 1 and ${MAX_FILL_WEEKS} weeks.`, values };
  if (!(Number.isInteger(startAtWeek) && startAtWeek >= 0 && startAtWeek < MAX_PATTERN_WEEKS)) return { error: "Choose which week of the pattern to start with.", values };
  const result = await withOrganisation(db, organisationId, async (tx) => {
    const filled = await fillFromPattern(tx, { organisationId, patternId, fromWeek: monday, weeks, startAtWeek });
    if (!filled) return null;
    await tx.insert(schema.auditEvent).values({
      organisationId,
      actorUserId: user.id,
      requestId: await requestId(),
      action: "fill_from_pattern",
      entity: "rota_pattern",
      entityId: patternId,
      data: { fromWeek: monday, weeks, startAtWeek: startAtWeek + 1, ...filled },
    });
    return filled;
  });
  if (!result) return { error: "That pattern could not be found.", values };
  revalidatePath("/rota");
  if (!result.added) return { ok: result.skipped ? "Every shift is already on the rota for those weeks. Nothing was added." : "That pattern has no shifts." };
  return {
    ok:
      `${plural(result.added, "draft shift")} added over ${plural(weeks, "week")}` +
      (result.skipped ? `, ${result.skipped} already on the rota` : "") +
      "." +
      (result.madeOpen ? ` ${plural(result.madeOpen, "shift")} fell on someone's leave or sickness, so ${result.madeOpen === 1 ? "it was added as an open shift" : "they were added as open shifts"} for cover.` : "") +
      " Check each week on the rota, then publish.",
  };
}

export async function deleteRotaPattern(form: FormData) {
  const { user, organisationId } = await requireManager();
  const id = String(form.get("patternId") ?? "");
  await withOrganisation(db, organisationId, async (tx) => {
    const [gone] = await tx
      .delete(schema.rotaPattern)
      .where(and(eq(schema.rotaPattern.id, id), eq(schema.rotaPattern.organisationId, organisationId)))
      .returning({ name: schema.rotaPattern.name });
    if (gone) {
      await tx.insert(schema.auditEvent).values({ organisationId, actorUserId: user.id, requestId: await requestId(), action: "delete", entity: "rota_pattern", entityId: id, data: { name: gone.name } });
    }
  });
  revalidatePath("/rota/patterns");
}
