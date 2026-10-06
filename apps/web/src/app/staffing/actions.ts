"use server";

import { schema, withOrganisation } from "@vicisrota/db";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireManager } from "@/lib/business";
import { db } from "@/lib/db";
import { requestId } from "@/lib/request";

export type FormState = { error?: string; ok?: string };

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

const refresh = () => {
  revalidatePath("/staffing");
  revalidatePath("/rota");
};

/** Adds a safe staffing level. Workplace and role are checked against this business's own records. */
export async function addStaffingLevel(_: FormState, form: FormData): Promise<FormState> {
  const { user, organisationId } = await requireManager();
  const locationId = String(form.get("locationId") ?? "") || null;
  const roleId = String(form.get("roleId") ?? "") || null;
  const weekdays = [...new Set(form.getAll("weekday").map(Number))].filter((d) => d >= 1 && d <= 7).sort();
  const startsAt = String(form.get("startsAt") ?? "");
  const rawEnd = String(form.get("endsAt") ?? "");
  const endsAt = rawEnd === "00:00" ? "24:00" : rawEnd;
  const minPeople = Number(form.get("minPeople"));
  const strict = form.get("strict") === "on";
  if (weekdays.length === 0) return { error: "Tick at least one day." };
  if (!TIME.test(startsAt) || !(TIME.test(endsAt) || endsAt === "24:00")) return { error: "Enter a start and end time." };
  if (!Number.isInteger(minPeople) || minPeople < 1 || minPeople > 99) return { error: "Enter how many people, from 1 to 99." };

  return withOrganisation(db, organisationId, async (tx): Promise<FormState> => {
    // Foreign keys skip row-level security, so confirm the workplace and role belong to this business.
    if (locationId && !(await tx.select({ id: schema.location.id }).from(schema.location).where(eq(schema.location.id, locationId))).length)
      return { error: "That workplace could not be found. Refresh the page." };
    if (roleId && !(await tx.select({ id: schema.jobRole.id }).from(schema.jobRole).where(eq(schema.jobRole.id, roleId))).length)
      return { error: "That job role could not be found. Refresh the page." };
    const [row] = await tx
      .insert(schema.staffingLevel)
      .values({ organisationId, locationId, roleId, weekdays, startsAt, endsAt, minPeople, strict })
      .returning({ id: schema.staffingLevel.id });
    await tx.insert(schema.auditEvent).values({
      organisationId,
      actorUserId: user.id,
      requestId: await requestId(),
      action: "create",
      entity: "staffing_level",
      entityId: row!.id,
      data: { locationId, roleId, weekdays, startsAt, endsAt, minPeople, strict },
    });
    refresh();
    return { ok: "Staffing level added. The rota now checks every week against it." };
  });
}

export async function removeStaffingLevel(form: FormData) {
  const { user, organisationId } = await requireManager();
  const id = String(form.get("id") ?? "");
  await withOrganisation(db, organisationId, async (tx) => {
    const [row] = await tx.delete(schema.staffingLevel).where(eq(schema.staffingLevel.id, id)).returning();
    if (!row) return;
    await tx.insert(schema.auditEvent).values({
      organisationId,
      actorUserId: user.id,
      requestId: await requestId(),
      action: "delete",
      entity: "staffing_level",
      entityId: id,
      data: { locationId: row.locationId, roleId: row.roleId, weekdays: row.weekdays, startsAt: row.startsAt, endsAt: row.endsAt, minPeople: row.minPeople },
    });
  });
  refresh();
}
