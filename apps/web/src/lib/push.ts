import { schema } from "@vicisrota/db";
import { eq, inArray } from "drizzle-orm";
import webpush from "web-push";
import { db } from "./db";
import { log } from "./log";

/**
 * App notifications (Web Push). They cost nothing to send, unlike texts. The keys are made once by
 * deploy/install.sh or update.sh and kept in deploy/.env; without them nothing is pushed, and people
 * still see everything on their own page.
 */
export const pushPublicKey = () => process.env.VAPID_PUBLIC_KEY || null;
export const pushConfigured = () => !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);

let ready = false;
const setup = () => {
  if (ready) return;
  const site = process.env.APP_URL ?? "";
  // The push services only accept an https address or an email as the sender's contact.
  webpush.setVapidDetails(site.startsWith("https://") ? site : "https://vicisrota.app", process.env.VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!);
  ready = true;
};

export type PushMessage = { title: string; body: string; url: string; /** Replaces an earlier notification with the same tag on the device. */ tag: string };

/**
 * Pushes one message to every device these logins turned notifications on for. Devices the push
 * service says are gone (the person uninstalled or blocked it) are forgotten. Returns how many
 * devices accepted it.
 */
export const sendPush = async (userIds: string[], message: PushMessage, urgent = false): Promise<number> => {
  if (!pushConfigured() || !userIds.length) return 0;
  setup();
  const devices = await db.select().from(schema.pushSubscription).where(inArray(schema.pushSubscription.userId, userIds));
  let sent = 0;
  for (const d of devices) {
    try {
      await webpush.sendNotification({ endpoint: d.endpoint, keys: { p256dh: d.p256dh, auth: d.auth } }, JSON.stringify(message), {
        TTL: urgent ? 3_600 : 24 * 3_600,
        urgency: urgent ? "high" : "normal",
        topic: message.tag.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 32) || undefined,
      });
      sent++;
    } catch (error) {
      const status = (error as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) await db.delete(schema.pushSubscription).where(eq(schema.pushSubscription.id, d.id));
      else await log("warn", "app notification failed", { status: status ?? null, error: String(error).slice(0, 200) });
    }
  }
  return sent;
};
