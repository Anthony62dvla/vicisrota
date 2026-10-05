"use server";

import { schema, withOrganisation } from "@vicisrota/db";
import { normaliseUkMobile } from "@vicisrota/messaging";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireManager } from "@/lib/business";
import { db } from "@/lib/db";
import { STATUS_LABEL, UUID, type ApplicantStatus } from "@/lib/hiring";
import { requestId } from "@/lib/request";
import { addingBlocked } from "@/lib/plan";

export type FormState = { error?: string; ok?: string; values?: Record<string, string> };

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** A new job advert. It is open, so the link works, straight away. */
export async function createJobPost(_: FormState, form: FormData): Promise<FormState> {
  const { user, organisationId } = await requireManager();
  const field = (k: string, max: number) => String(form.get(k) ?? "").trim().slice(0, max);
  const values = {
    title: field("title", 120),
    roleId: field("roleId", 40),
    place: field("place", 200),
    hours: field("hours", 200),
    pay: field("pay", 200),
    description: field("description", 6000),
  };
  if (!values.title) return { error: "Give the job a title, for example Care worker.", values };
  if (!values.description) return { error: "Describe the job, in plain words.", values };
  const [post] = await withOrganisation(db, organisationId, (tx) =>
    tx
      .insert(schema.jobPost)
      .values({
        organisationId,
        title: values.title,
        roleId: UUID.test(values.roleId) ? values.roleId : null,
        place: values.place || null,
        hours: values.hours || null,
        pay: values.pay || null,
        description: values.description,
        createdByUserId: user.id,
      })
      .returning({ id: schema.jobPost.id }),
  );
  redirect(`/hiring/${post!.id}`);
}

/** Close an advert so nobody else can apply, or open it again. */
export async function setPostOpen(form: FormData) {
  const { organisationId } = await requireManager();
  const id = String(form.get("id") ?? "");
  if (!UUID.test(id)) return;
  await withOrganisation(db, organisationId, (tx) =>
    tx.update(schema.jobPost).set({ open: form.get("open") === "true" }).where(eq(schema.jobPost.id, id)),
  );
  revalidatePath(`/hiring/${id}`);
  revalidatePath("/hiring");
}

/** Move an applicant along (shortlisted, interview and so on) and keep notes. */
export async function updateApplicant(_: FormState, form: FormData): Promise<FormState> {
  const { organisationId } = await requireManager();
  const id = String(form.get("id") ?? "");
  const status = String(form.get("status") ?? "") as ApplicantStatus;
  const notes = String(form.get("notes") ?? "").trim().slice(0, 4000);
  if (!UUID.test(id)) return { error: "This applicant could not be found." };
  // Hired is only set by taking someone on, so a staff record always exists for it.
  if (!(status in STATUS_LABEL) || status === "hired") return { error: "Choose where they are up to." };
  const done = await withOrganisation(db, organisationId, (tx) =>
    tx
      .update(schema.applicant)
      .set({ status, notes: notes || null })
      .where(and(eq(schema.applicant.id, id), eq(schema.applicant.organisationId, organisationId)))
      .returning({ postId: schema.applicant.jobPostId }),
  );
  if (!done.length) return { error: "This applicant could not be found." };
  revalidatePath(`/hiring/${done[0]!.postId}`);
  return { ok: "Saved." };
}

/**
 * Takes the applicant on: creates their staff record and pay rate, then opens it, where the manager
 * records right to work and other checks and sends the invitation to set up their login.
 */
export async function hireApplicant(_: FormState, form: FormData): Promise<FormState> {
  const { user, organisationId } = await requireManager();
  const id = String(form.get("id") ?? "");
  const dateOfBirth = String(form.get("dateOfBirth") ?? "");
  const employmentStart = String(form.get("employmentStart") ?? "");
  const rate = Number(String(form.get("hourlyRate") ?? "").replace("£", ""));
  if (!UUID.test(id)) return { error: "This applicant could not be found." };
  if (!DATE.test(dateOfBirth)) return { error: "Enter their date of birth. It is needed for minimum wage and working time rules." };
  if (!DATE.test(employmentStart)) return { error: "Enter the date they start." };
  if (!(rate > 0 && rate < 1000)) return { error: "Enter an hourly rate in pounds, for example 12.71." };
  const full = await addingBlocked(organisationId);
  if (full) return { error: full };

  const workerId = await withOrganisation(db, organisationId, async (tx) => {
    const [a] = await tx.select().from(schema.applicant).where(eq(schema.applicant.id, id));
    if (!a) return null;
    if (a.hiredWorkerId) return a.hiredWorkerId;
    const mobile = a.phone ? normaliseUkMobile(a.phone) : null;
    const [worker] = await tx
      .insert(schema.worker)
      .values({ organisationId, fullName: a.name, dateOfBirth, employmentStart, mobile })
      .returning({ id: schema.worker.id });
    const hourlyPence = Math.round(rate * 100);
    await tx.insert(schema.payRate).values({ organisationId, workerId: worker!.id, hourlyPence, effectiveFrom: employmentStart });
    await tx.update(schema.applicant).set({ status: "hired", hiredWorkerId: worker!.id }).where(eq(schema.applicant.id, id));
    await tx.insert(schema.auditEvent).values({
      organisationId,
      actorUserId: user.id,
      requestId: await requestId(),
      action: "create",
      entity: "worker",
      entityId: worker!.id,
      data: { fullName: a.name, hourlyPence, rateFrom: employmentStart, fromApplicant: id },
    });
    return worker!.id;
  });
  if (!workerId) return { error: "This applicant could not be found." };
  revalidatePath("/staff");
  revalidatePath("/hiring", "layout");
  redirect(`/staff/${workerId}?welcome=1`);
}
