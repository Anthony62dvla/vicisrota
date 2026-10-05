"use server";

import { COURSE_URL_MAX, courseLink } from "@vicisrota/compliance";
import { schema, withOrganisation } from "@vicisrota/db";
import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireManager } from "@/lib/business";
import { db } from "@/lib/db";
import { requestId } from "@/lib/request";

export type FormState = { error?: string; ok?: string; values?: Record<string, string> };

const refresh = () => {
  revalidatePath("/training");
  revalidatePath("/checks");
  revalidatePath("/me");
  revalidatePath("/staff", "layout");
};

const BAD_LINK = `Enter a web address of up to ${COURSE_URL_MAX} characters, such as www.example.co.uk/food-hygiene, or leave it empty.`;

/** Saves, changes or clears where staff can do one kind of training. */
export async function saveCourseLink(_: FormState, form: FormData): Promise<FormState> {
  const { user, organisationId } = await requireManager();
  const id = String(form.get("id") ?? "");
  const typed = String(form.get("courseUrl") ?? "").trim();
  const courseUrl = typed ? courseLink(typed) : null;
  if (typed && !courseUrl) return { error: BAD_LINK, values: { courseUrl: typed } };
  return withOrganisation(db, organisationId, async (tx): Promise<FormState> => {
    const [row] = await tx.update(schema.qualification).set({ courseUrl }).where(eq(schema.qualification.id, id)).returning({ name: schema.qualification.name });
    if (!row) return { error: "That training could not be found. Refresh the page." };
    await tx.insert(schema.auditEvent).values({
      organisationId,
      actorUserId: user.id,
      requestId: await requestId(),
      action: "update",
      entity: "qualification",
      entityId: id,
      data: { courseUrl },
    });
    refresh();
    return { ok: courseUrl ? `Saved. Staff now see a link to this course.` : `Link removed.`, values: { courseUrl: courseUrl ?? "" } };
  });
}

/** Adds a kind of training the business tracks, with an optional course link. */
export async function addTraining(_: FormState, form: FormData): Promise<FormState> {
  const { user, organisationId } = await requireManager();
  const name = String(form.get("name") ?? "").trim().replace(/\s+/g, " ");
  const typed = String(form.get("courseUrl") ?? "").trim();
  const values = { name, courseUrl: typed };
  if (!name || name.length > 80) return { error: "Enter the training name, up to 80 characters, for example Food hygiene (level 2).", values };
  const courseUrl = typed ? courseLink(typed) : null;
  if (typed && !courseUrl) return { error: BAD_LINK, values };
  const result = await withOrganisation(db, organisationId, async (tx): Promise<FormState> => {
    const [clash] = await tx.select({ id: schema.qualification.id }).from(schema.qualification).where(sql`lower(${schema.qualification.name}) = lower(${name})`);
    if (clash) return { error: `${name} is already on your list. Change its link below.`, values };
    const [row] = await tx.insert(schema.qualification).values({ organisationId, name, courseUrl }).returning({ id: schema.qualification.id });
    await tx.insert(schema.auditEvent).values({
      organisationId,
      actorUserId: user.id,
      requestId: await requestId(),
      action: "create",
      entity: "qualification",
      entityId: row!.id,
      data: { name, courseUrl },
    });
    return { ok: `${name} added.` };
  });
  refresh();
  return result;
}
