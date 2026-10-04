import { schema, withOrganisation } from "@vicisrota/db";
import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { requireUser } from "./auth";
import { db } from "./db";

/**
 * The signed-in user's first business and their role in it.
 * For now a user works in their first business; a business switcher comes later.
 */
const firstMembership = async (userId: string) =>
  (
    await db
      .select({
        organisationId: schema.membership.organisationId,
        role: schema.membership.role,
        name: schema.organisation.name,
        sector: schema.organisation.sector,
      })
      .from(schema.membership)
      .innerJoin(schema.organisation, eq(schema.membership.organisationId, schema.organisation.id))
      .where(eq(schema.membership.userId, userId))
      .orderBy(schema.membership.createdAt)
      .limit(1)
  )[0];

/** The signed-in manager and the business they are working in. Staff are sent to their own page. */
export const requireManager = async () => {
  const user = await requireUser();
  const membership = await firstMembership(user.id);
  if (!membership) redirect("/dashboard");
  if (membership.role === "worker") redirect("/me");
  return { user, organisationId: membership.organisationId, businessName: membership.name, sector: membership.sector };
};

/** The signed-in member of staff and their own staff record. Managers are sent to the dashboard. */
export const requireStaff = async () => {
  const user = await requireUser();
  const membership = await firstMembership(user.id);
  if (!membership || membership.role !== "worker") redirect("/dashboard");
  const [worker] = await withOrganisation(db, membership.organisationId, (tx) =>
    tx.select().from(schema.worker).where(and(eq(schema.worker.userId, user.id), eq(schema.worker.organisationId, membership.organisationId))),
  );
  if (!worker) redirect("/dashboard");
  return { user, organisationId: membership.organisationId, businessName: membership.name, worker };
};
