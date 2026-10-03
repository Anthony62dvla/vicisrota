import { schema } from "@vicisrota/db";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { requireUser } from "./auth";
import { db } from "./db";

/**
 * The signed-in manager and the business they are working in.
 * For now a user works in their first business; a business switcher comes later.
 */
export const requireManager = async () => {
  const user = await requireUser();
  const [membership] = await db
    .select({ organisationId: schema.membership.organisationId, role: schema.membership.role, name: schema.organisation.name })
    .from(schema.membership)
    .innerJoin(schema.organisation, eq(schema.membership.organisationId, schema.organisation.id))
    .where(eq(schema.membership.userId, user.id))
    .orderBy(schema.membership.createdAt)
    .limit(1);
  if (!membership) redirect("/dashboard");
  if (membership.role === "worker") redirect("/dashboard");
  return { user, organisationId: membership.organisationId, businessName: membership.name };
};
