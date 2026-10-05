"use server";

import { schema } from "@vicisrota/db";
import { sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { myBusinesses, rememberBusiness } from "@/lib/business";
import { db } from "@/lib/db";
import { log } from "@/lib/log";
import { applyPack } from "@/lib/apply-pack";
import { requestId } from "@/lib/request";
import { packById } from "@/lib/sector-packs";

export async function createBusiness(formData: FormData) {
  const user = await requireUser();
  const name = String(formData.get("name") ?? "").trim();
  const pack = packById(String(formData.get("kind") ?? ""));
  const starter = formData.get("starter") === "on";
  if (!name || !pack) throw new Error("Business name and type are required");
  const { sector } = pack;

  const reference = await requestId();
  // One transaction, so a failure never leaves a business without an owner or an audit record.
  const organisationId = await db.transaction(async (tx) => {
    const [org] = await tx.insert(schema.organisation).values({ name, sector, kind: pack.id, requiresEnhancedDbs: pack.enhancedDbs }).returning({ id: schema.organisation.id });
    const id = org!.id;
    await tx.insert(schema.membership).values({ organisationId: id, userId: user.id, role: "owner" });
    await tx.execute(sql`select set_config('app.organisation_id', ${id}, true)`);
    const added = starter ? await applyPack(tx, id, pack) : null;
    await tx.insert(schema.auditEvent).values({
      organisationId: id,
      actorUserId: user.id,
      requestId: reference,
      action: "create",
      entity: "organisation",
      entityId: id,
      data: { name, sector, kind: pack.id, starter: added },
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
