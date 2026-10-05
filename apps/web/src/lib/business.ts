import { schema, withOrganisation } from "@vicisrota/db";
import { and, eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireUser } from "./auth";
import { db } from "./db";

export const BUSINESS_COOKIE = "vr_business";

/** Every business the user belongs to, oldest first, with their role in each. */
export const myBusinesses = async (userId: string) =>
  db
    .select({
      organisationId: schema.membership.organisationId,
      role: schema.membership.role,
      name: schema.organisation.name,
      sector: schema.organisation.sector,
    })
    .from(schema.membership)
    .innerJoin(schema.organisation, eq(schema.membership.organisationId, schema.organisation.id))
    .where(eq(schema.membership.userId, userId))
    .orderBy(schema.membership.createdAt);

/**
 * The business the user is working in now: the one they last switched to on this device, or their first.
 * The cookie only chooses between businesses they belong to; it never grants access on its own.
 */
export const currentMembership = async (userId: string) => {
  const all = await myBusinesses(userId);
  const chosen = (await cookies()).get(BUSINESS_COOKIE)?.value;
  return all.find((b) => b.organisationId === chosen) ?? all[0];
};

/** Makes this business the one the user works in on this device. Call only after checking they belong to it. */
export const rememberBusiness = async (organisationId: string) =>
  (await cookies()).set(BUSINESS_COOKIE, organisationId, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 365 * 86_400 });

/** The signed-in manager and the business they are working in. Staff are sent to their own page. */
export const requireManager = async () => {
  const user = await requireUser();
  const membership = await currentMembership(user.id);
  if (!membership) redirect("/dashboard");
  if (membership.role === "worker") redirect("/me");
  return { user, organisationId: membership.organisationId, businessName: membership.name, sector: membership.sector };
};

/** The signed-in member of staff and their own staff record. Managers are sent to the dashboard. */
export const requireStaff = async () => {
  const user = await requireUser();
  const membership = await currentMembership(user.id);
  if (!membership || membership.role !== "worker") redirect("/dashboard");
  const [worker] = await withOrganisation(db, membership.organisationId, (tx) =>
    tx.select().from(schema.worker).where(and(eq(schema.worker.userId, user.id), eq(schema.worker.organisationId, membership.organisationId))),
  );
  if (!worker) redirect("/dashboard");
  return { user, organisationId: membership.organisationId, businessName: membership.name, worker };
};

/** Anyone signed in to a business, manager or staff: for pages everyone uses, such as team messages. */
export const requireMember = async () => {
  const user = await requireUser();
  const membership = await currentMembership(user.id);
  if (!membership) redirect("/dashboard");
  return { user, organisationId: membership.organisationId, businessName: membership.name, role: membership.role, isManager: membership.role !== "worker" };
};
