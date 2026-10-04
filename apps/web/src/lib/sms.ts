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

type Text = { to: string; body: string; /** What is kept in the log, when the text holds something secret such as a sign-in link. */ logBody?: string };

/**
 * Sends texts for a business. Each text is logged before it is sent, under a dedupe key, so the same
 * text is never sent twice to the same number even if two requests run at once. Returns how many
 * were sent successfully.
 */
export const sendTexts = async (organisationId: string, purpose: string, texts: Text[], dedupeKey: string | null = null): Promise<number> => {
  if (!texts.length) return 0;
  const reserved = await withOrganisation(db, organisationId, (tx) =>
    tx
      .insert(schema.smsMessage)
      .values(texts.map((t) => ({ organisationId, to: t.to, purpose, body: t.logBody ?? t.body, provider: getSender().name, ok: false, dedupeKey })))
      .onConflictDoNothing()
      .returning({ id: schema.smsMessage.id, to: schema.smsMessage.to }),
  );
  let sent = 0;
  for (const row of reserved) {
    const body = texts.find((t) => t.to === row.to)!.body;
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

/** Texts every active alert contact of a business, once per dedupe key. */
export const textAlertContacts = async (organisationId: string, purpose: string, body: string, dedupeKey: string): Promise<number> => {
  const contacts = await withOrganisation(db, organisationId, (tx) => tx.select().from(schema.alertContact).where(eq(schema.alertContact.active, true)));
  return sendTexts(organisationId, purpose, contacts.map((c) => ({ to: c.phone, body })), dedupeKey);
};
