"use server";

import { schema } from "@vicisrota/db";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { currentMembership } from "@/lib/business";
import { db } from "@/lib/db";
import { safeNextPath } from "@/lib/next-path";
import { SUPPORT_MAX } from "@/lib/support";

/** Saves a problem report for the VicisRota team. Only the reporter and VicisRota superadmins can read it. */
export async function reportProblem(form: FormData) {
  const user = await requireUser();
  const membership = await currentMembership(user.id);
  const what = String(form.get("what") ?? "").trim();
  const errorRef = String(form.get("ref") ?? "").trim().toUpperCase().slice(0, 40) || null;
  // Only the path is kept, not any query string.
  const page = safeNextPath(String(form.get("from") ?? ""))?.split("?")[0] ?? null;
  const back = new URLSearchParams({ ...(page ? { from: page } : {}), ...(errorRef ? { ref: errorRef } : {}) });
  if (!what) redirect(`/help?${back}&error=empty`);
  if (what.length > SUPPORT_MAX) redirect(`/help?${back}&error=long`);
  await db.insert(schema.supportReport).values({
    organisationId: membership?.organisationId ?? null,
    reporterUserId: user.id,
    reporterRole: membership?.role === "worker" ? "worker" : "manager",
    page,
    errorRef,
    what,
  });
  redirect("/help?sent=1");
}
