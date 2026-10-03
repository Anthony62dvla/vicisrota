import { schema } from "@vicisrota/db";
import { and, eq, gt, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { hashInviteToken } from "@/lib/invite";

/** An invitation that can still be used: not accepted, not replaced by a newer link, not expired. */
export const findOpenInvitation = async (token: string) => {
  if (!/^[A-Za-z0-9_-]{20,100}$/.test(token)) return undefined;
  const [row] = await db
    .select({ invitation: schema.invitation, businessName: schema.organisation.name })
    .from(schema.invitation)
    .innerJoin(schema.organisation, eq(schema.invitation.organisationId, schema.organisation.id))
    .where(
      and(
        eq(schema.invitation.tokenHash, hashInviteToken(token)),
        isNull(schema.invitation.acceptedAt),
        isNull(schema.invitation.revokedAt),
        gt(schema.invitation.expiresAt, new Date()),
      ),
    );
  return row;
};
