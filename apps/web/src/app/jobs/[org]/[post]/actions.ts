"use server";

import { schema, withOrganisation } from "@vicisrota/db";
import { and, count, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { tellManagersAboutApplicant, UUID } from "@/lib/hiring";
import { log } from "@/lib/log";

export type ApplyState = { error?: string; ok?: string; values?: Record<string, string> };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CONTACT = ["email", "phone", "text"];
/** Most applications one advert takes, so a flood of junk cannot fill the database. */
const MAX_APPLICANTS = 500;

/** An application from the public job page. No login needed. */
export async function apply(_: ApplyState, form: FormData): Promise<ApplyState> {
  const organisationId = String(form.get("organisationId") ?? "");
  const postId = String(form.get("postId") ?? "");
  const field = (k: string, max: number) => String(form.get(k) ?? "").trim().slice(0, max);
  const values = {
    name: field("name", 120),
    email: field("email", 200),
    phone: field("phone", 40),
    contactBy: field("contactBy", 10),
    about: field("about", 4000),
    adjustments: field("adjustments", 2000),
  };
  // A field people cannot see: only automated form-fillers complete it.
  if (String(form.get("website") ?? "")) return { ok: "Thank you. Your application has been sent." };
  if (!UUID.test(organisationId) || !UUID.test(postId)) return { error: "This job could not be found." };
  if (!values.name) return { error: "Please tell us your name.", values };
  if (!values.email && !values.phone) return { error: "Please give an email address or a phone number, so they can reply.", values };
  if (values.email && !EMAIL.test(values.email)) return { error: "Please check the email address.", values };
  if (!values.about) return { error: "Please tell them a little about yourself.", values };
  if (form.get("consent") !== "on") return { error: "Please tick the box to say they can keep your application.", values };

  const result = await withOrganisation(db, organisationId, async (tx) => {
    const [post] = await tx.select().from(schema.jobPost).where(and(eq(schema.jobPost.id, postId), eq(schema.jobPost.open, true)));
    if (!post) return null;
    const [{ n }] = (await tx.select({ n: count() }).from(schema.applicant).where(eq(schema.applicant.jobPostId, postId))) as [{ n: number }];
    if (n >= MAX_APPLICANTS) return "full" as const;
    await tx.insert(schema.applicant).values({
      organisationId,
      jobPostId: postId,
      name: values.name,
      email: values.email || null,
      phone: values.phone || null,
      contactBy: CONTACT.includes(values.contactBy) ? values.contactBy : null,
      about: values.about,
      adjustments: values.adjustments || null,
    });
    return post;
  });
  if (!result) return { error: "Sorry, this job is no longer taking applications." };
  if (result === "full") return { error: "Sorry, this job has had a lot of applications and is not taking any more." };
  await log("info", "job application received", { organisationId, postId });
  await tellManagersAboutApplicant(organisationId, result.title);
  return { ok: "Thank you. Your application has been sent." };
}
