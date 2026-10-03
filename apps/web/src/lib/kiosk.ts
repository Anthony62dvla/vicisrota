import { createHash, randomBytes } from "node:crypto";
import { schema } from "@vicisrota/db";
import { and, eq, isNull } from "drizzle-orm";
import { cookies } from "next/headers";
import { db } from "./db";

export const KIOSK_COOKIE = "vr_kiosk";

export const newKioskToken = () => randomBytes(32).toString("base64url");
export const hashKioskToken = (token: string) => createHash("sha256").update(token).digest("hex");

/** The clock-in tablet this browser has been set up as, or null. */
export const currentKiosk = async () => {
  const token = (await cookies()).get(KIOSK_COOKIE)?.value;
  if (!token) return null;
  const [row] = await db
    .select({ device: schema.kioskDevice, businessName: schema.organisation.name })
    .from(schema.kioskDevice)
    .innerJoin(schema.organisation, eq(schema.kioskDevice.organisationId, schema.organisation.id))
    .where(and(eq(schema.kioskDevice.tokenHash, hashKioskToken(token)), isNull(schema.kioskDevice.revokedAt)));
  return row ?? null;
};
