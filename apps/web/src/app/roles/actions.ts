"use server";

import { schema, withOrganisation } from "@vicisrota/db";
import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireManager } from "@/lib/business";
import { db } from "@/lib/db";
import { requestId } from "@/lib/request";
import { ROLE_COLOURS, type RoleColour } from "@/lib/role-labels";
import { SUGGESTED_BY_NAME } from "@/lib/role-suggestions";

export type FormState = { error?: string; ok?: string; values?: Record<string, string> };

const refresh = () => {
  revalidatePath("/roles");
  revalidatePath("/rota");
  revalidatePath("/staff", "layout");
};

export async function addRole(_: FormState, form: FormData): Promise<FormState> {
  const { user, organisationId } = await requireManager();
  const name = String(form.get("name") ?? "").trim().replace(/\s+/g, " ");
  const colour = String(form.get("colour") ?? "") as RoleColour;
  const values = { name, colour };
  if (!name || name.length > 40) return { error: "Enter a role name of up to 40 characters, for example Chef.", values };
  if (!ROLE_COLOURS.includes(colour)) return { error: "Choose a colour.", values };
  const result = await withOrganisation(db, organisationId, async (tx): Promise<FormState> => {
    const [clash] = await tx.select({ id: schema.jobRole.id }).from(schema.jobRole).where(sql`lower(${schema.jobRole.name}) = lower(${name})`);
    if (clash) return { error: `There is already a role called ${name}.`, values };
    const [row] = await tx.insert(schema.jobRole).values({ organisationId, name, colour }).returning({ id: schema.jobRole.id });
    await tx.insert(schema.auditEvent).values({
      organisationId,
      actorUserId: user.id,
      requestId: await requestId(),
      action: "create",
      entity: "job_role",
      entityId: row!.id,
      data: { name, colour },
    });
    return { ok: `${name} added. Now tick it on the staff records of the people who can work it.` };
  });
  refresh();
  return result;
}

/** Removes a role. Shifts that used it keep their times and people; they just no longer show a role. */
export async function removeRole(form: FormData) {
  const { user, organisationId } = await requireManager();
  const id = String(form.get("id") ?? "");
  await withOrganisation(db, organisationId, async (tx) => {
    const [row] = await tx.delete(schema.jobRole).where(eq(schema.jobRole.id, id)).returning();
    if (!row) return;
    await tx.insert(schema.auditEvent).values({
      organisationId,
      actorUserId: user.id,
      requestId: await requestId(),
      action: "delete",
      entity: "job_role",
      entityId: id,
      data: { name: row.name },
    });
  });
  refresh();
}

/** Sets which roles a person can work, from the ticked boxes on their staff record. */
export async function saveWorkerRoles(_: FormState, form: FormData): Promise<FormState> {
  const { user, organisationId } = await requireManager();
  const workerId = String(form.get("workerId") ?? "");
  const roleIds = [...new Set(form.getAll("roleId").map(String))];
  const result = await withOrganisation(db, organisationId, async (tx): Promise<FormState> => {
    // Foreign keys skip row-level security, so confirm the person and roles belong to this business.
    const [worker] = await tx.select({ name: schema.worker.fullName }).from(schema.worker).where(eq(schema.worker.id, workerId));
    if (!worker) return { error: "That person could not be found." };
    const known = await tx.select({ id: schema.jobRole.id, name: schema.jobRole.name }).from(schema.jobRole);
    const chosen = known.filter((r) => roleIds.includes(r.id));
    if (chosen.length !== roleIds.length) return { error: "Some of those roles no longer exist. Refresh the page." };
    await tx.delete(schema.workerRole).where(and(eq(schema.workerRole.workerId, workerId)));
    if (chosen.length) await tx.insert(schema.workerRole).values(chosen.map((r) => ({ organisationId, workerId, roleId: r.id })));
    await tx.insert(schema.auditEvent).values({
      organisationId,
      actorUserId: user.id,
      requestId: await requestId(),
      action: "update",
      entity: "worker_role",
      entityId: workerId,
      data: { roles: chosen.map((r) => r.name) },
    });
    return { ok: chosen.length ? `${worker.name} can work as ${chosen.map((r) => r.name).join(", ")}.` : `${worker.name} has no job roles.` };
  });
  refresh();
  return result;
}

/** Adds the ticked ready-made roles in one go. Roles the business already has are skipped. */
export async function addSuggestedRoles(_: FormState, form: FormData): Promise<FormState> {
  const { user, organisationId } = await requireManager();
  const picked = [...new Set(form.getAll("role").map((n) => String(n).toLowerCase()))].flatMap((n) => SUGGESTED_BY_NAME.get(n) ?? []);
  if (!picked.length) return { error: "Tick at least one role to add." };
  const result = await withOrganisation(db, organisationId, async (tx): Promise<FormState> => {
    const existing = new Set((await tx.select({ name: schema.jobRole.name }).from(schema.jobRole)).map((r) => r.name.toLowerCase()));
    const fresh = picked.filter((r) => !existing.has(r.name.toLowerCase()));
    if (!fresh.length) return { ok: "You already have all of those roles." };
    await tx.insert(schema.jobRole).values(fresh.map((r) => ({ organisationId, name: r.name, colour: r.colour })));
    await tx.insert(schema.auditEvent).values({
      organisationId,
      actorUserId: user.id,
      requestId: await requestId(),
      action: "create",
      entity: "job_role",
      entityId: null,
      data: { names: fresh.map((r) => r.name), fromSuggestions: true },
    });
    const skipped = picked.length - fresh.length;
    return { ok: `Added ${fresh.length} role${fresh.length === 1 ? "" : "s"}${skipped ? ` (${skipped} you already had)` : ""}. Now tick them on the staff records of the people who can work them.` };
  });
  refresh();
  return result;
}
