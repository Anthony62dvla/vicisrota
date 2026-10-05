"use server";

import { schema } from "@vicisrota/db";
import { sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { myBusinesses, rememberBusiness } from "@/lib/business";
import { db } from "@/lib/db";
import { log } from "@/lib/log";
import { requestId } from "@/lib/request";

const SECTORS = ["care", "hospitality", "small_business"] as const;
type Sector = (typeof SECTORS)[number];

export async function createBusiness(formData: FormData) {
  const user = await requireUser();
  const name = String(formData.get("name") ?? "").trim();
  const sector = String(formData.get("sector") ?? "") as Sector;
  if (!name || !SECTORS.includes(sector)) throw new Error("Business name and type are required");

  const reference = await requestId();
  // One transaction, so a failure never leaves a business without an owner or an audit record.
  const organisationId = await db.transaction(async (tx) => {
    const [org] = await tx.insert(schema.organisation).values({ name, sector, requiresEnhancedDbs: sector === "care" }).returning({ id: schema.organisation.id });
    const id = org!.id;
    await tx.insert(schema.membership).values({ organisationId: id, userId: user.id, role: "owner" });
    await tx.execute(sql`select set_config('app.organisation_id', ${id}, true)`);
    await tx.insert(schema.auditEvent).values({
      organisationId: id,
      actorUserId: user.id,
      requestId: reference,
      action: "create",
      entity: "organisation",
      entityId: id,
      data: { name, sector },
    });
    return id;
  });
  await log("info", "business created", { organisationId, sector });
  await rememberBusiness(organisationId);
  redirect("/dashboard");
}

/** Moves to another business the user belongs to, on this device. */
export async function switchBusiness(formData: FormData) {
  const user = await requireUser();
  const target = String(formData.get("organisationId") ?? "");
  const membership = (await myBusinesses(user.id)).find((b) => b.organisationId === target);
  if (!membership) redirect("/dashboard");
  await rememberBusiness(membership.organisationId);
  redirect(membership.role === "worker" ? "/me" : "/dashboard");
}
