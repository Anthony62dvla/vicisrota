import { schema } from "@vicisrota/db";
import { and, eq, gt, isNull } from "drizzle-orm";
import { db } from "./db";
import { hashInviteToken } from "./invite";

/** How long a new customer's owner link works. Longer than staff links: onboarding calls get rescheduled. */
export const OWNER_INVITE_DAYS = 14;

/** An owner invitation that can still be used. */
export const findOpenOwnerInvitation = async (token: string) => {
  if (!/^[A-Za-z0-9_-]{20,100}$/.test(token)) return undefined;
  const [row] = await db
    .select({ invitation: schema.ownerInvitation, businessName: schema.organisation.name })
    .from(schema.ownerInvitation)
    .innerJoin(schema.organisation, eq(schema.ownerInvitation.organisationId, schema.organisation.id))
    .where(
      and(
        eq(schema.ownerInvitation.tokenHash, hashInviteToken(token)),
        isNull(schema.ownerInvitation.acceptedAt),
        isNull(schema.ownerInvitation.revokedAt),
        gt(schema.ownerInvitation.expiresAt, new Date()),
      ),
    );
  return row;
};
