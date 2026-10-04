import { schema } from "@vicisrota/db";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { requireUser } from "./auth";
import { db } from "./db";
import { requestId } from "./request";

export const isSuperadmin = async (userId: string) =>
  (await db.select({ id: schema.platformAdmin.userId }).from(schema.platformAdmin).where(eq(schema.platformAdmin.userId, userId))).length > 0;

/** VicisRota staff only. Everyone else gets a plain "not found", so the area is not advertised. */
export const requireSuperadmin = async () => {
  const user = await requireUser();
  if (!(await isSuperadmin(user.id))) notFound();
  return user;
};

/** Writes to the superadmin trail. Every superadmin action and lookup goes here. */
export const recordPlatformAction = async (actorUserId: string, action: string, organisationId: string | null, data: Record<string, unknown>) =>
  db.insert(schema.platformAudit).values({ actorUserId, action, organisationId, data: { ...data, requestId: await requestId() } });
