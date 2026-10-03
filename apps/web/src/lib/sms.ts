import { senderFromEnv, type SmsSender } from "@vicisrota/messaging";
import { schema, withOrganisation } from "@vicisrota/db";
import { eq } from "drizzle-orm";
import { db } from "./db";
import { log } from "./log";

let sender: SmsSender | undefined;
const getSender = () => (sender ??= senderFromEnv(process.env));

/** True when texts actually go out; false when they are only logged. */
export const smsConfigured = () => process.env.SMS_PROVIDER === "http";

export const appUrl = (path: string) => `${(process.env.APP_URL ?? process.env.BETTER_AUTH_URL ?? "").replace(/\/$/, "")}${path}`;

/**
 * Texts every active alert contact of a business. Each text is logged before it is sent, under a
 * dedupe key, so an alert is never sent twice to the same person even if two checks run at once.
 * Returns how many were sent successfully.
 */
export const textAlertContacts = async (organisationId: string, purpose: string, body: string, dedupeKey: string): Promise<number> => {
  const reserved = await withOrganisation(db, organisationId, async (tx) => {
    const contacts = await tx.select().from(schema.alertContact).where(eq(schema.alertContact.active, true));
    if (!contacts.length) return [];
    return tx
      .insert(schema.smsMessage)
      .values(contacts.map((c) => ({ organisationId, to: c.phone, purpose, body, provider: getSender().name, ok: false, dedupeKey })))
      .onConflictDoNothing()
      .returning({ id: schema.smsMessage.id, to: schema.smsMessage.to });
  });
  let sent = 0;
  for (const row of reserved) {
    const result = await getSender().send(row.to, body);
    if (result.ok) sent++;
    else await log("error", "text message failed", { organisationId, purpose, error: result.error });
    await withOrganisation(db, organisationId, (tx) =>
      tx
        .update(schema.smsMessage)
        .set({ ok: result.ok, providerRef: result.providerRef ?? null, error: result.error ?? null })
        .where(eq(schema.smsMessage.id, row.id)),
    );
  }
  return sent;
};
