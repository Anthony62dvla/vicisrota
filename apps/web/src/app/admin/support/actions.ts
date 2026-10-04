"use server";

import { schema } from "@vicisrota/db";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { recordPlatformAction, requireSuperadmin } from "@/lib/superadmin";
import { SUPPORT_MAX, triageReport } from "@/lib/support";

const reportOf = async (id: string) => (await db.select().from(schema.supportReport).where(eq(schema.supportReport.id, id)))[0];

/** Asks the assistant for a triage of one report. Nothing is sent to the reporter. */
export async function triage(form: FormData) {
  const admin = await requireSuperadmin();
  const report = await reportOf(String(form.get("id")));
  if (!report) return;
  const sector = report.organisationId
    ? ((await db.select({ sector: schema.organisation.sector }).from(schema.organisation).where(eq(schema.organisation.id, report.organisationId)))[0]?.sector ?? null)
    : null;
  const result = await triageReport({ what: report.what, page: report.page, errorRef: report.errorRef, reporterRole: report.reporterRole, sector });
  if (result) {
    await db
      .update(schema.supportReport)
      .set({ triage: result, triagedAt: new Date(), status: report.status === "new" ? "triaged" : report.status })
      .where(eq(schema.supportReport.id, report.id));
  }
  await recordPlatformAction(admin.id, result ? "support_triage" : "support_triage_failed", report.organisationId, { reportId: report.id });
  revalidatePath("/admin/support");
}

/** Sends a reply, which the reporter sees on their Report a problem page. A person always writes or approves it. */
export async function reply(form: FormData) {
  const admin = await requireSuperadmin();
  const report = await reportOf(String(form.get("id")));
  const text = String(form.get("reply") ?? "").trim();
  if (!report || !text || text.length > SUPPORT_MAX) return;
  await db.update(schema.supportReport).set({ reply: text, repliedAt: new Date(), status: "replied" }).where(eq(schema.supportReport.id, report.id));
  await recordPlatformAction(admin.id, "support_reply", report.organisationId, { reportId: report.id });
  revalidatePath("/admin/support");
}

export async function close(form: FormData) {
  const admin = await requireSuperadmin();
  const report = await reportOf(String(form.get("id")));
  if (!report) return;
  await db.update(schema.supportReport).set({ status: "closed" }).where(eq(schema.supportReport.id, report.id));
  await recordPlatformAction(admin.id, "support_close", report.organisationId, { reportId: report.id });
  revalidatePath("/admin/support");
}
